import prisma from '../utils/prismaClient';
// Removed UserRole from @prisma/client import as it's not a Prisma enum
import { flag_comments as PrismaFlagComment, users as PrismaUser, flags as PrismaFlag, Prisma, audit_logs as PrismaAuditLog } from '@prisma/client'; 

// Define UserRole constants (should match definition in flagRoutes.ts or a central location)
const UserRole = {
    ADMIN: 'ADMIN',
    REVIEWER: 'REVIEWER',
    PUBLISHER: 'PUBLISHER',
};

// Custom Error Base
class ServiceError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export class FlagNotFoundError extends ServiceError {
  constructor(flagId: string) {
    super(`Flag with ID ${flagId} not found.`, 404);
  }
}

export class OperationNotPermittedError extends ServiceError {
  constructor(message: string = 'Operation not permitted.') {
    super(message, 403); // 403 Forbidden
  }
}

// Define the structure of the comment when enriched with user details
export interface EnrichedFlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: Date;
  updated_at?: Date | null; // Can be null if not set
  user: { 
    id: string;
    name: string; // User name from schema is non-nullable
    role: string;
  };
}

// Define the type for the flag object when specific relations are included for authorization and enrichment
const flagWithAuthAndCommentRelationsArgs = {
  include: {
    content_items: { // Include the full content_items object to access its fields and relations
      include: {     // And then include its relations
        publishers: { select: { name: true } }, // For content_items.publishers.name
        scan_jobs: { 
          select: { 
            name: true, 
            advertisers: { select: { organization_id: true, name: true } } // For authorization
          } 
        },
        content_images: { // Include content_images related to content_items
          select: {
            id: true,        // PK of content_images table (useful for keys, may not be GCS media ID)
            file_path: true, // Expected to be GCS URL/path
            image_type: true 
            // Ensure all fields needed by frontend transformation are here
          }
        }
        // Prisma will automatically include scalar fields of content_items (like platform, url, title, caption, content_type)
        // when using 'include' for its relations, unless a 'select' is also specified for content_items itself.
        // To be explicit and ensure we get what we need from content_items directly:
        // We might need to switch content_items to a 'select' and manually list all scalar fields
        // AND then for its relations, use nested 'select's.
        // For now, let's try with include and see if Prisma fetches scalar fields of content_items.
        // If not, we'll adjust to a more explicit select structure.
      }
    },
    products: { // For the product linked directly to the flag
      select: { name: true },
    },
    users: { // For the user (reviewer) linked directly to the flag
      select: { name: true },
    },
    // The top-level 'content_images' linked via 'image_reference_id' on the flag is removed
    // as we are targeting the media associated with the content_item.
    // If that direct link from flag to a specific content_image is also needed for other purposes,
    // it could be added back, perhaps with a different alias if it conflicts.
    comments: { // Relation name on flags model for flag_comments
      orderBy: { created_at: 'asc' as const },
      select: { 
        id: true,
        flag_id: true,
        user_id: true,
        comment: true,
        created_at: true,
        // updated_at: true, // This line is confirmed to be problematic and should be removed
        user: { select: { name: true, role: true, id: true } },
      },
    },
  },
};
type PrismaFlagWithDetails = Prisma.flagsGetPayload<typeof flagWithAuthAndCommentRelationsArgs>; // Use the args object here

// Type for the result of flag_comments.create when selecting specific fields including the user relation
type CreatedFlagCommentPayload = {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: Date;
  updated_at: Date | null; // updated_at is set by DB, will be on the returned object
  user: {
    name: string | null;
    role: string;
  } | null;
};
// This type is now for the *result* of the create operation if these fields were selected.
// However, the actual create call will be simpler.
// Let's simplify and type `newComment` directly from the create call's result.


// Define a more complete type for an enriched flag, including comments
// This will now be based on PrismaFlagWithDetails
export interface EnrichedFlag extends PrismaFlagWithDetails {}


class FlagService {
  public async addCommentByReviewer(
    flagId: string,
    userId: string,
    organizationId: string,
    commentText: string
  ): Promise<EnrichedFlagComment> {
    // Fetch flag with relations needed for authorization
    const flag = await prisma.flags.findUnique({
      where: { id: flagId },
      include: { // Simplified include for this specific authorization path
        content_items: {
          include: {
            scan_jobs: {
              include: {
                advertisers: {
                  select: { organization_id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!flag) {
      throw new FlagNotFoundError(flagId);
    }

    let flagOrgId: string | null | undefined = null;
    // Type assertion to help TypeScript understand the nested structure after include
    const typedFlag = flag as unknown as Prisma.flagsGetPayload<{
        include: { content_items: { include: { scan_jobs: { include: { advertisers: { select: { organization_id: true }}}}}}}
    }>;

    if (typedFlag.content_items?.scan_jobs?.advertisers?.organization_id) {
        flagOrgId = typedFlag.content_items.scan_jobs.advertisers.organization_id;
    }

    if (!flagOrgId || flagOrgId !== organizationId) {
      console.error(`Permission denied for user org ${organizationId} to access flag org ${flagOrgId || 'undefined'}`);
      throw new OperationNotPermittedError('Access to this flag is denied for your organization.');
    }

    // Define an explicit type for the result of the create operation with the include
    type NewCommentWithUser = PrismaFlagComment & {
      user: { name: string | null; role: string; id: string; } | null;
    };

    const newComment = await prisma.flag_comments.create({
      data: {
        flag_id: flagId,
        user_id: userId,
        comment: commentText,
      },
      include: { 
        user: { select: { name: true, role: true, id: true } } 
      },
    }) as NewCommentWithUser; // Cast to the explicit type

    // newComment will have all fields of flag_comments (including db-set updated_at), plus the included user
    // The user object from include will be non-null if the relation is mandatory.
    // The cast above should ensure newComment.user is correctly typed.
    if (!newComment.user) { 
        throw new Error('User data not found for the new comment.');
    }

    return {
      id: newComment.id,
      flag_id: newComment.flag_id,
      user_id: newComment.user_id,
      comment: newComment.comment,
      created_at: newComment.created_at,
      updated_at: (newComment as any).updated_at ?? null, // Try casting to any to access updated_at
      user: { // User is now guaranteed to be non-null here
          id: newComment.user.id, 
          name: newComment.user.name as string, // Cast name to string as EnrichedFlagComment expects string
          role: newComment.user.role,
      },
    };
  }

  // Fetches a flag by ID, including its comments, and performs organization-based authorization.
  public async getFlagDetailsForReviewer(flagId: string, organizationId: string): Promise<EnrichedFlag> {
    const flag: PrismaFlagWithDetails | null = await prisma.flags.findUnique({
      where: { id: flagId },
      ...flagWithAuthAndCommentRelationsArgs // Spread the plain args object
    });

    // ADD THIS LOG:
    console.log('Fetched flag object directly from Prisma in service:', JSON.stringify(flag, null, 2)); 

    if (!flag) {
      throw new FlagNotFoundError(flagId);
    }

    let flagOrgId: string | null | undefined = null;
    if (flag.content_items?.scan_jobs?.advertisers?.organization_id) {
        flagOrgId = flag.content_items.scan_jobs.advertisers.organization_id;
    }

    if (!flagOrgId || flagOrgId !== organizationId) {
      console.error(`Permission denied for user org ${organizationId} to access flag org ${flagOrgId || 'undefined'} (getFlagDetailsForReviewer)`);
      throw new OperationNotPermittedError('Access to this flag is denied for your organization.');
    }
    
    // Transform comments to match EnrichedFlagComment.
    // If flag.comments[].user is guaranteed non-null by Prisma schema & select,
    // then the EnrichedFlagComment.user should also be non-null.
    const transformedComments: EnrichedFlagComment[] = (flag.comments || []).map(c => {
      if (!c.user) {
        // This should not happen if the relation is mandatory and selected.
        // Handle defensively or throw, depending on strictness.
        console.error(`Comment ${c.id} is missing user data.`);
        // Fallback or skip this comment
        return {
          id: c.id, flag_id: c.flag_id, user_id: c.user_id, comment: c.comment,
          created_at: c.created_at, updated_at: null, // c.updated_at will not exist due to select
          user: { id: 'unknown', name: 'Unknown User', role: 'UNKNOWN' } // Fallback user
        };
      }
      return {
        id: c.id,
        flag_id: c.flag_id,
        user_id: c.user_id,
        comment: c.comment,
        created_at: c.created_at,
        updated_at: null, // c.updated_at will not exist due to select
        user: { // User is non-null here
            id: c.user.id,
            name: c.user.name,
            role: c.user.role,
        },
      };
    });
    
    return { ...flag, comments: transformedComments };
  }

  public async deleteComment(
    commentId: string,
    requestingUserId: string,
    requestingUserRole: string,
    flagId: string // Included for context, though commentId is primary key
  ): Promise<void> {
    // Fetch the comment to check ownership and existence
    const comment = await prisma.flag_comments.findUnique({
      where: { id: commentId },
      select: { user_id: true, flag_id: true }, // Select only necessary fields
    });

    if (!comment) {
      throw new ServiceError(`Comment with ID ${commentId} not found.`, 404);
    }

    // Verify the comment belongs to the given flagId, as an extra check
    if (comment.flag_id !== flagId) {
      throw new ServiceError(`Comment ${commentId} does not belong to flag ${flagId}.`, 400); // Bad request
    }

    // Authorization: Admin can delete any comment. Users can delete their own comments.
    const isAdmin = requestingUserRole === UserRole.ADMIN;
    const isOwner = comment.user_id === requestingUserId;

    if (!isAdmin && !isOwner) {
      throw new OperationNotPermittedError('You are not authorized to delete this comment.');
    }

    // Proceed with deletion
    await prisma.flag_comments.delete({
      where: { id: commentId },
    });
    // No return value needed for a successful delete operation (typically 204 No Content)
  }

  /**
   * Deletes a flag by ID and creates an audit log entry with the flag's details.
   * Only users with ADMIN or REVIEWER roles can delete flags.
   * 
   * @param flagId - The ID of the flag to delete
   * @param userId - The ID of the user performing the deletion
   * @param userRole - The role of the user performing the deletion
   * @param organizationId - The organization ID for authorization
   * @returns Promise<void>
   * @throws FlagNotFoundError if the flag doesn't exist
   * @throws OperationNotPermittedError if the user is not authorized
   */
  public async deleteFlag(
    flagId: string,
    userId: string,
    userRole: string,
    organizationId: string
  ): Promise<void> {
    // Authorization check - only ADMIN or REVIEWER can delete flags
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.REVIEWER) {
      throw new OperationNotPermittedError('Only administrators and reviewers can delete flags.');
    }

    // Fetch the flag with all its details for the audit log
    const flag = await prisma.flags.findUnique({
      where: { id: flagId },
      include: {
        content_items: {
          include: {
            scan_jobs: {
              include: {
                advertisers: {
                  select: { organization_id: true, name: true }
                }
              }
            },
            publishers: { select: { name: true, id: true } }
          }
        },
        products: { select: { name: true, id: true } },
        users: { select: { name: true, id: true } },
        comments: {
          include: {
            user: { select: { name: true, role: true } }
          }
        }
      }
    });

    if (!flag) {
      throw new FlagNotFoundError(flagId);
    }

    // Organization-based authorization
    let flagOrgId: string | null | undefined = null;
    if (flag.content_items?.scan_jobs?.advertisers?.organization_id) {
      flagOrgId = flag.content_items.scan_jobs.advertisers.organization_id;
    }

    if (!flagOrgId || flagOrgId !== organizationId) {
      console.error(`Permission denied for user org ${organizationId} to access flag org ${flagOrgId || 'undefined'} (deleteFlag)`);
      throw new OperationNotPermittedError('Access to this flag is denied for your organization.');
    }

    // Use a transaction to ensure both the audit log creation and flag deletion succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Create audit log entry with flag details
      await tx.audit_logs.create({
        data: {
          action: 'FLAG_DELETED',
          details: {
            flag_id: flag.id,
            content_item_id: flag.content_item_id,
            rule_id: flag.rule_id,
            product_id: flag.product_id,
            product_name: flag.products?.name,
            publisher_id: flag.content_items?.publishers?.id,
            publisher_name: flag.content_items?.publishers?.name,
            content_source: flag.content_source,
            context_text: flag.context_text,
            transcript_start_ms: flag.transcript_start_ms,
            transcript_end_ms: flag.transcript_end_ms,
            ai_confidence: flag.ai_confidence,
            ai_evaluation: flag.ai_evaluation,
            ai_ruling: flag.ai_ruling,
            ai_confidence_reasoning: flag.ai_confidence_reasoning,
            status: flag.status,
            human_verdict: flag.human_verdict,
            human_verdict_reasoning: flag.human_verdict_reasoning,
            ai_feedback_notes: flag.ai_feedback_notes,
            internal_notes: flag.internal_notes,
            flag_source: flag.flag_source,
            rule_type: flag.rule_type,
            rule_version_applied: flag.rule_version_applied,
            created_at: flag.created_at,
            updated_at: flag.updated_at,
            comments: flag.comments?.map(c => ({
              id: c.id,
              user_name: c.user?.name,
              user_role: c.user?.role,
              comment: c.comment,
              created_at: c.created_at
            }))
          },
          user_id: userId
        }
      });

      // Delete the flag
      await tx.flags.delete({
        where: { id: flagId }
      });
    });
  }
}

export default new FlagService();
