import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// Flag status enum matching backend
export enum FlagStatus {
  NEW = 'NEW',
  IN_REVIEW = 'IN_REVIEW',
  REMEDIATING = 'REMEDIATING',
  CLOSED = 'CLOSED',
}

// Human verdict enum matching backend
export enum HumanVerdict {
  VIOLATION = 'VIOLATION',
  COMPLIANT = 'COMPLIANT',
}

// Resolution method enum matching backend
export enum ResolutionMethod {
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  AI_AUTO_CLOSE = 'AI_AUTO_CLOSE',
  AI_AUTO_REMEDIATE = 'AI_AUTO_REMEDIATE',
}

// TypeScript interfaces
export interface FlagContent {
  type: string;
  url?: string;
  transcript?: string;
  ruleText: string;
  aiReasoning: string;
  aiVerdict: string;
}

// Define nested structures based on API response
interface Publisher {
  id?: string; // Optional if only name is needed
  name: string | null;
}

interface ScanJob {
  id?: string; // Optional if only name is needed
  name: string | null;
}

interface Product {
  id?: string; // Optional if only name is needed
  name: string | null;
}

interface User {
  id?: string; // Optional if only name is needed
  name: string | null;
}

interface ContentItem {
  id?: string; // Optional if only ID is needed elsewhere
  url: string | null;
  caption?: string | null; // Optional based on schema/usage
  title?: string | null;   // Optional based on schema/usage
  transcript?: any | null; // Keep as any or define structure
  platform?: string | null; // Add platform based on usage in components
  publishers: Publisher | null; // Nested publisher
  scan_jobs?: ScanJob | null;  // Nested scan job (optional based on include)
}


// Main Flag interface reflecting the actual API response structure
export interface Flag {
  id: string;
  content_item_id: string; // Foreign key
  rule_id: string;
  product_id?: string | null;
  content_source: string;
  context_text: string | null;
  transcript_start_ms?: number | null;
  transcript_end_ms?: number | null;
  ai_confidence: number;
  ai_evaluation: string;
  ai_ruling: string;
  ai_confidence_reasoning?: string | null;
  status: FlagStatus;
  comments?: FlagComment[]; // Added for reviewer/publisher communication
  human_verdict?: HumanVerdict | null;
  human_verdict_reasoning?: string | null;
  ai_feedback_notes?: string | null;
  internal_notes?: string | null;
  flag_source: string;
  rule_type: string;
  rule_version_applied: string;
  resolution_method?: ResolutionMethod | null;
  created_at: string;
  updated_at: string;
  reviewer_id?: string | null;
  assignee?: string | null; // This might be redundant if users relation is present

  // Include the nested relations returned by the API
  content_items: ContentItem | null; // Nested content item
  products: Product | null;        // Nested product
  users: User | null;              // Nested user (reviewer/assignee)
  // comments?: FlagComment[]; // Already added above, this was a duplicate thought.
  // Remove potentially redundant/confusing top-level UI fields
  // scanJob?: string; // Use products.name instead
  // publisher?: string; // Use content_items.publishers.name instead
  // product?: string; // Use products.name instead
  // rule?: string; // Use rule_id / rule_type instead
  // date?: string; // Use created_at instead
  // content?: FlagContent; // This seems unused/redundant with nested data
}

export interface FlagUpdatePayload {
  status?: FlagStatus;
  human_verdict?: HumanVerdict | null;
  human_verdict_reasoning?: string | null;
  ai_feedback_notes?: string | null;
  internal_notes?: string | null;
  assignee_id?: string | null;
}

export interface FlagFilterParams {
  status?: FlagStatus;
  scanJobId?: string;
  publisherId?: string;
  productId?: string;
  ruleId?: string;
  aiRuling?: string;
  humanVerdict?: HumanVerdict;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  platform?: string; // Changed from channelId to platform
  page?: number; // Added for pagination
  pageSize?: number; // Added for pagination
}

// Interface for the channel options fetched from the new endpoint - REMOVED as we hardcode platforms now
// export interface ChannelOption {
//   id: string;
//   name: string; // e.g., "youtube: Example Channel URL"
// }

// API service for flag operations
export interface ChannelOption {
  id: string;
  name: string; // e.g., "youtube: Example Channel URL"
}

// Interface for individual flag comments (matches EnrichedFlagComment from backend)
export interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string; // Dates are typically strings after JSON serialization
  updated_at?: string;
  user_name: string | null;
  user_role: string; // Consider a frontend UserRole enum if roles are used extensively in UI logic
}

// Expected structure for paginated API response
export interface PaginatedFlagsResponse {
  data: Flag[];
  totalFlags: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
}

// API service for flag operations
export const flagService = {
  /**
   * Get flags with optional filtering and pagination.
   * If `params.page` and `params.pageSize` are provided, the backend is expected to return a `PaginatedFlagsResponse`.
   * Otherwise, the backend is expected to return a `Flag[]` array (for backward compatibility).
   * The `apiClient.get` call is typed to reflect this potential union type in the response data.
   * @param params Optional filter and pagination parameters (`FlagFilterParams`).
   * @returns A Promise resolving to an AxiosResponse whose `data` property can be `PaginatedFlagsResponse` or `Flag[]`.
   */
  getFlags: (params?: FlagFilterParams) => {
    // If page or pageSize is provided, expect PaginatedFlagsResponse
    // Otherwise, expect Flag[] for backward compatibility if the backend supports it.
    // However, our backend route now always returns the paginated structure if page/pageSize are involved,
    // or the simple array if not. The frontend component will always pass page/pageSize for the flag review.
    return apiClient.get<PaginatedFlagsResponse | Flag[]>(ENDPOINTS.FLAGS, { params });
  },

  /**
   * Get a specific flag by ID
   * @param id The flag ID
   * @returns Promise with flag details
   */
  getFlag: (id: string) => {
    return apiClient.get<Flag>(ENDPOINTS.FLAGS_BY_ID(id));
  },

  /**
   * Update a flag's status, verdict, etc.
   * @param flagId The flag ID
   * @param updateData The update data
   * @returns Promise with the updated flag
   */
  updateFlag: (flagId: string, updateData: FlagUpdatePayload) => {
    return apiClient.patch<Flag>(ENDPOINTS.FLAGS_BY_ID(flagId), updateData);
  },

  /**
   * Batch update flags
   * @param flagIds Array of flag IDs
   * @param updateData The update data to apply to all flags
   * @returns Promise with the updated flags
   */
  batchUpdateFlags: (flagIds: string[], updateData: FlagUpdatePayload) => {
    return apiClient.patch<Flag[]>(ENDPOINTS.FLAGS, {
      flagIds,
      ...updateData,
    });
  },

  /**
   * Export flags to CSV
   * @param params Filter parameters for the flags to export
   * @returns Promise with the CSV data
   */
  exportFlags: (params?: FlagFilterParams) => {
    return apiClient.get<Blob>(`${ENDPOINTS.FLAGS}/export`, {
      params,
      responseType: 'blob',
    });
  },

  /**
   * Fetches a temporary access URL for a specific media item.
   * @param contentItemId The ID of the content item.
   * @param mediaId The ID of the media file (content_images record).
   * @returns Promise resolving to an object containing the mediaAccessUrl.
   */
  getMediaAccessUrl: (contentItemId: string, mediaId: string) => {
    // The ENDPOINTS.MEDIA.GET_ACCESS_URL function already prepends /api
    // so we use it directly. apiClient prepends the base URL.
    // The actual URL will be like: http://localhost:3001/api/v1/media-access-url/:contentItemId/:mediaId
    // But apiClient is configured with baseURL: 'http://localhost:3001/api',
    // so the path passed to apiClient.get should be relative to that, e.g., /v1/media-access-url/...
    return apiClient.get<{ mediaAccessUrl: string }>(
      ENDPOINTS.MEDIA.GET_ACCESS_URL(contentItemId, mediaId)
    );
  },

  /**
   * Add a comment to a flag by a reviewer/admin.
   * @param flagId The flag ID
   * @param comment The comment text
   * @returns Promise with the newly created comment
   */
  addFlagComment: async (flagId: string, comment: string): Promise<FlagComment> => {
    // Assuming ENDPOINTS.FLAGS_BY_ID_COMMENTS will be defined like (id) => `/flags/${id}/comments`
    // If not, use the direct path: `/flags/${flagId}/comments`
    const endpoint = ENDPOINTS.FLAGS_BY_ID_COMMENTS ? ENDPOINTS.FLAGS_BY_ID_COMMENTS(flagId) : `/flags/${flagId}/comments`;
    const response = await apiClient.post<FlagComment>(endpoint, { comment });
    return response.data;
  },

  /**
   * Delete a specific comment from a flag.
   * @param flagId The flag ID
   * @param commentId The comment ID to delete
   * @returns Promise indicating success or failure
   */
  deleteFlagComment: async (flagId: string, commentId: string): Promise<void> => {
    // Assuming ENDPOINTS.FLAGS_BY_ID_COMMENT_BY_ID will be defined like (flagId, commentId) => `/flags/${flagId}/comments/${commentId}`
    // This endpoint needs to be added to frontend/src/services/api/endpoints.ts
    const endpoint = ENDPOINTS.FLAGS_BY_ID_COMMENT_BY_ID 
      ? ENDPOINTS.FLAGS_BY_ID_COMMENT_BY_ID(flagId, commentId) 
      : `/flags/${flagId}/comments/${commentId}`; // Fallback if not defined, though it should be
    await apiClient.delete(endpoint);
    // DELETE typically returns 204 No Content on success, so no data to return.
    // If backend returns data, adjust Promise type and return response.data
  },

  /**
   * Delete a flag entirely from the database.
   * This is used when a flag was created improperly and needs to be removed.
   * @param flagId The ID of the flag to delete
   * @returns Promise indicating success or failure
   */
  deleteFlag: async (flagId: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.FLAGS_BY_ID(flagId));
    // DELETE typically returns 204 No Content on success, so no data to return.
  },
};

export default flagService;
