/**
 * API Endpoints for the Credit Compliance Tool
 * This file contains all the API endpoints used throughout the application
 */

export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  
  // Organizations
  ORGANIZATIONS: '/organizations',
  
  // Products
  PRODUCTS: '/products',
  PRODUCT_BY_ID: (id: string) => `/products/${id}`,
  
  // Advertisers
  ADVERTISERS: '/advertisers',
  ADVERTISER_BY_ID: (id: string) => `/advertisers/${id}`,
  
  // Publishers
  PUBLISHERS: '/publishers',
  PUBLISHER_BY_ID: (id: string) => `/publishers/${id}`,
  // CHANNELS endpoint removed
  
  // Users
  USERS: '/users',
  USER_BY_ID: (id: string) => `/users/${id}`,

  // Rules
  PRODUCT_RULES: '/product-rules',
  CHANNEL_RULES: '/channel-rules',
  RULE_SETS: '/rule-sets',
  RULE_SET_BY_ID: (id: string) => `/rule-sets/${id}`,
  
  // Scan Jobs
  SCAN_JOBS: '/scan-jobs',
  SCAN_JOB_BY_ID: (id: string) => `/scan-jobs/${id}`,
  START_SCAN: '/scan-jobs/start-channel-scan', // For single channel scans
  START_MULTI_TARGET_SCAN: '/scan-jobs/start-multi-target-scan', // For multi-target scans
  
  // Flags
  FLAGS: '/flags',
  FLAGS_BY_ID: (id: string) => `/flags/${id}`,
  FLAGS_BY_ID_COMMENTS: (id: string) => `/flags/${id}/comments`, // For POSTing new comments or GETting all comments for a flag
  FLAGS_BY_ID_COMMENT_BY_ID: (flagId: string, commentId: string) => `/flags/${flagId}/comments/${commentId}`, // For DELETEing a specific comment

  // Dashboard
  DASHBOARD: {
    FLAG_STATS: '/dashboard/flag-stats',
    VIOLATION_STATS: '/dashboard/violation-stats',
    AI_STATS: '/dashboard/ai-stats',
    PROCESSING_METRICS: '/dashboard/processing-metrics',
    COMPLIANCE_OVERVIEW: '/dashboard/compliance-overview',
    AI_CONFIDENCE: '/dashboard/ai-confidence',
    SUMMARY: '/dashboard/summary',
    AI_BYPASS_ANALYSIS: '/dashboard/ai-bypass-analysis', // New
  },

  // System Settings (or a more appropriate existing category)
  SYSTEM_SETTINGS: {
    AI_BYPASS_THRESHOLD: '/system-settings/ai-bypass-threshold', // New
    AI_BYPASS_SETTINGS: '/system-settings/ai-bypass-settings', // Added for fetching settings
    REVERT_AUTO_BYPASS: '/system-settings/revert-auto-bypass', // Added for reverting
  },

  // Media specific endpoints
  MEDIA: {
    GET_ACCESS_URL: (contentItemId: string, mediaId: string) => `/v1/media-access-url/${contentItemId}/${mediaId}`,
  }
};

export default ENDPOINTS;
