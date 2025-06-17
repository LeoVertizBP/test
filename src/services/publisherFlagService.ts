import prisma from '../utils/prismaClient';
import { Prisma, FlagStatus } from '@prisma/client'; // Revert to combined import
import { validate as uuidValidate } from 'uuid'; // Import UUID validation function

// Helper function to validate UUID
const isValidUuid = (id: string): boolean => {
  try {
    return uuidValidate(id);
  } catch (error) {
    return false;
  }
};

// Define potential custom error types
class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
class InvalidStateError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'InvalidStateError';
    }
  }

class PublisherFlagService {

  /**
   * Fetches flags assigned to a specific publisher, filtered by status.
   * Includes related data like content item and comments.
   * @param publisherId - The ID of the publisher.
   * @param statuses - An array of FlagStatus values to filter by.
   * @returns A list of flags matching the criteria.
   */
  async getFlags(publisherId: string, statuses: FlagStatus[]) {
    console.log(`PublisherFlagService: Fetching flags for publisher ${publisherId} with statuses: ${statuses.join(', ')}`);

    // Validate publisherId (should already be cleaned by the controller)
    if (!publisherId || !isValidUuid(publisherId)) {
      console.warn(`Invalid publisher ID format received by service: ${publisherId}`);
      return []; // Return empty array for invalid UUIDs
    }

    const flags = await prisma.flags.findMany({
      where: {
        content_items: {
          publisher_id: publisherId, // Filter by publisher ID via content_items relation
        },
        status: {
          in: statuses, // Filter by the provided status array
        },
      },
      include: {
        // Include related data needed for display
        content_items: {
          select: { 
            url: true, 
            platform: true, 
            channel_url: true, 
            title: true, 
            scan_date: true,
            // Include publisher info to show publisher name
            publishers: {
              select: { id: true, name: true }
            },
            // Include scan job info (might be useful for UI)
            scan_jobs: {
              select: { id: true, name: true }
            }
          },
        },
        // Comments are no longer needed for the main list summary
        // comments: { 
        //   orderBy: { created_at: 'asc' }, 
        //   include: {
        //     user: { select: { id: true, name: true, role: true } } 
        //   }
        // },
        // Include rule-related information based on rule_id and rule_type
        // Since we can't directly use the polymorphic relation via Prisma
        users: { 
          select: { id: true, name: true, role: true } // Include reviewer info
        },
        products: { // Product information
          select: { id: true, name: true }
        }
        // We cannot directly include 'rules' as it's not a direct relation.
        // Rule details would need to be fetched separately based on flag.rule_id and flag.rule_type.
      },
      orderBy: {
        created_at: 'desc', // Order flags by creation date
      },
    });

    // Enhance flags with structured data for the controller/frontend
    const enhancedFlags = flags.map(flag => {
      const product_name = flag.products?.name || null;
      const description = flag.context_text || flag.ai_evaluation || "No context available.";
      
      // Use rule_citation or rule_section for a basic rule name/summary for the list view.
      // The full rule details are shown in the modal.
      const rule_name_summary = flag.rule_citation || flag.rule_section || "Violation Detected";
      const rule_violation_text_summary = flag.rule_citation || "View details for full rule information.";

      return {
        ...flag, // Spread the original flag object (includes flag.products, flag.comments, etc.)
        product_name, // Ensure product_name is at the top level for the controller
        description,  // Ensure description (context_text) is at the top level
        rule_name: rule_name_summary, // Provide a simplified rule name
        rule_violation_text: rule_violation_text_summary, // Provide a simplified/placeholder rule text
      };
    });

    console.log(`PublisherFlagService: Found ${enhancedFlags.length} flags for publisher ${publisherId}`);
    return enhancedFlags;
  }

  /**
   * Adds a comment to a specific flag on behalf of a user (publisher).
   * Performs authorization check to ensure the flag belongs to the publisher.
   * @param userId - The ID of the user adding the comment.
   * @param publisherId - The ID of the publisher (from token) for authorization.
   * @param flagId - The ID of the flag to comment on.
   * @param commentText - The text content of the comment.
   * @returns The newly created comment record.
   * @throws NotFoundError if the flag doesn't exist.
   * @throws AuthorizationError if the flag does not belong to the publisher.
   */
  async addComment(userId: string, publisherId: string, flagId: string, commentText: string) {
    console.log(`PublisherFlagService: User ${userId} (Publisher ${publisherId}) attempting to add comment to flag ${flagId}`);

    // Validate UUIDs to prevent database errors with more meaningful error messages
    if (!userId || !isValidUuid(userId)) {
      console.error(`Invalid user ID format: ${userId}`);
      throw new AuthorizationError(`Invalid user ID format. Please ensure you're properly authenticated.`);
    }
    
    if (!publisherId || !isValidUuid(publisherId)) {
      console.error(`Invalid publisher ID format: ${publisherId}`);
      throw new AuthorizationError(`Invalid publisher ID format. Please ensure your account is properly configured.`);
    }
    
    if (!flagId || !isValidUuid(flagId)) {
      console.error(`Invalid flag ID format: ${flagId}`);
      throw new NotFoundError(`Flag not found. The requested flag ID is invalid.`);
    }

    // 1. Verify the flag exists and belongs to this publisher
    const flag = await prisma.flags.findUnique({
      where: { id: flagId },
      select: { id: true, content_items: { select: { publisher_id: true } } },
    });

    if (!flag) {
      throw new NotFoundError(`Flag with ID ${flagId} not found.`);
    }

    if (flag.content_items?.publisher_id !== publisherId) {
      throw new AuthorizationError(`Publisher ${publisherId} is not authorized to comment on flag ${flagId}.`);
    }

    // 2. Create the comment
    const newComment = await prisma.flag_comments.create({
      data: {
        flag_id: flagId,
        user_id: userId,
        comment: commentText,
      },
       include: { // Include user info in the returned comment
            user: { select: { id: true, name: true, role: true } }
       }
    });

    console.log(`PublisherFlagService: Comment added successfully to flag ${flagId} by user ${userId}`);
    return newComment;
  }

  /**
   * Updates the status of a specific flag, typically by a publisher marking it as 'REMEDIATION_COMPLETE'.
   * Performs authorization checks.
   * @param userId - The ID of the user performing the update.
   * @param publisherId - The ID of the publisher (from token) for authorization.
   * @param flagId - The ID of the flag to update.
   * @param newStatus - The target status (should be REMEDIATION_COMPLETE for publishers).
   * @returns The updated flag record.
   * @throws NotFoundError if the flag doesn't exist.
   * @throws AuthorizationError if the flag does not belong to the publisher.
   * @throws InvalidStateError if the flag is not in a state that allows this transition (e.g., not REMEDIATING).
   */
  async updateStatus(userId: string, publisherId: string, flagId: string, newStatus: FlagStatus) {
    console.log(`PublisherFlagService: User ${userId} (Publisher ${publisherId}) attempting to update flag ${flagId} status to ${newStatus}`);

    // Validate UUIDs to prevent database errors
    if (!userId || !isValidUuid(userId)) {
      throw new AuthorizationError(`Invalid user ID format: ${userId}`);
    }
    
    if (!publisherId || !isValidUuid(publisherId)) {
      throw new AuthorizationError(`Invalid publisher ID format: ${publisherId}`);
    }
    
    if (!flagId || !isValidUuid(flagId)) {
      throw new NotFoundError(`Invalid flag ID format: ${flagId}`);
    }

    // 1. Verify the flag exists and belongs to this publisher
    const flag = await prisma.flags.findUnique({
      where: { id: flagId },
      select: { id: true, status: true, content_items: { select: { publisher_id: true } } },
    });

    if (!flag) {
      throw new NotFoundError(`Flag with ID ${flagId} not found.`);
    }

    if (flag.content_items?.publisher_id !== publisherId) {
      throw new AuthorizationError(`Publisher ${publisherId} is not authorized to update flag ${flagId}.`);
    }

    // 2. Check if the transition is valid (Publisher should only move from REMEDIATING to REMEDIATION_COMPLETE)
    if (flag.status !== FlagStatus.REMEDIATING) {
        throw new InvalidStateError(`Flag ${flagId} is not in REMEDIATING status. Current status: ${flag.status}`);
    }
    if (newStatus !== FlagStatus.REMEDIATION_COMPLETE) {
         throw new InvalidStateError(`Invalid target status '${newStatus}'. Publisher can only set status to REMEDIATION_COMPLETE.`);
    }


    // 3. Update the flag status and set the completion timestamp
    const updatedFlag = await prisma.flags.update({
      where: { id: flagId },
      data: {
        status: newStatus,
        remediation_completed_at: new Date(), // Set completion timestamp
        // Potentially clear reviewer_id if needed upon publisher submission? Discuss logic.
      },
    });

    console.log(`PublisherFlagService: Flag ${flagId} status updated successfully to ${newStatus} by user ${userId}`);
    // TODO: Consider adding an audit log entry here
    return updatedFlag;
  }
}

export default new PublisherFlagService();
export { AuthorizationError, NotFoundError, InvalidStateError }; // Export custom errors
