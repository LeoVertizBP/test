import apiClient from './api/client';
import { ENDPOINTS } from './api/endpoints';

// TypeScript interfaces
export interface FlagStats {
  total: number;
  pending: number;
  inReview: number;
  remediating: number;
  closed: number;
  trend: {
    date: string;
    count: number;
  }[];
}

export interface ViolationStats {
  total: number;
  byPublisher: {
    publisher: string;
    count: number;
    percentage: number;
  }[];
  byProduct: {
    product: string;
    count: number;
    percentage: number;
  }[];
  bySeverity: {
    severity: string;
    count: number;
    percentage: number;
  }[];
  trend: {
    date: string;
    count: number;
  }[];
}

export interface AIStats {
  totalAnalyzed: number;
  averageConfidence: number;
  confidenceDistribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  agreementRate: number;
  disagreementRate: number;
  feedbackCount: number;
}

export interface ProcessingMetrics {
  averageProcessingTime: number;
  itemsProcessed: {
    date: string;
    count: number;
  }[];
  queueLength: number;
  processingByContentType: {
    contentType: string;
    averageTime: number;
    count: number;
  }[];
}

export interface ComplianceOverview {
  publishers: {
    name: string;
    totalItems: number;
    flaggedItems: number;
    violationRate: number;
    trend: number; // positive for increasing compliance, negative for decreasing
    avgRemediationTimeHours: number; // Average time from remediation start to close
    remediationTrend: number; // Trend in remediation time (positive means improving/faster)
  }[];
}

// New Interface for AI Bypass Analysis Data
export interface AIBypassAnalysisData {
  humanAiAgreementRate: number;
  flagsAboveThresholdPercentage: number;
  totalFlagsConsideredForAgreement: number;
  totalFlagsAboveThreshold: number;
  totalProjectFlags?: number; // Optional
}

// New Interface for setting AI Bypass Threshold
export interface SetAIBypassThresholdPayload {
  threshold: number | null; // Can be null to disable
  autoApproveCompliant: boolean;
  autoRemediateViolation: boolean;
  applyRetroactively: boolean;
}

// Interface for the response when setting/clearing the threshold
export interface SetAIBypassThresholdResponse {
  message: string;
  // Optionally, include the updated settings object if the API returns it
  settings?: AIBypassSettingsData;
}

// Interface for fetching current AI Bypass settings
export interface AIBypassSettingsData {
  threshold: number | null;
  autoApproveCompliantEnabled: boolean;
  autoRemediateViolationEnabled: boolean;
}

// Interface for the response of the revert action
export interface RevertAIBypassResponse {
  message: string;
  revertedCount?: number;
}

export interface AIConfidenceData {
  message: string;
}

export interface AIConfidenceData {
  byRule: {
    rule: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
  byPublisher: {
    publisher: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
  byContentType: {
    contentType: string;
    averageConfidence: number;
    sampleSize: number;
  }[];
}

export interface DashboardFilterParams {
  startDate?: string;
  endDate?: string;
  publisherId?: string;
  productId?: string;
  advertiserId?: string;
}

// API service for dashboard metrics operations
export const dashboardService = {
  /**
   * Get flag statistics 
   * @param params Optional filter parameters
   * @returns Promise with flag statistics
   */
  getFlagStats: (params?: DashboardFilterParams) => {
    return apiClient.get<FlagStats>(ENDPOINTS.DASHBOARD.FLAG_STATS, { params });
  },
  
  /**
   * Get violation statistics
   * @param params Optional filter parameters
   * @returns Promise with violation statistics
   */
  getViolationStats: (params?: DashboardFilterParams) => {
    return apiClient.get<ViolationStats>(ENDPOINTS.DASHBOARD.VIOLATION_STATS, { params });
  },
  
  /**
   * Get AI performance statistics
   * @param params Optional filter parameters
   * @returns Promise with AI statistics
   */
  getAIStats: (params?: DashboardFilterParams) => {
    return apiClient.get<AIStats>(ENDPOINTS.DASHBOARD.AI_STATS, { params });
  },
  
  /**
   * Get content processing metrics
   * @param params Optional filter parameters
   * @returns Promise with processing metrics
   */
  getProcessingMetrics: (params?: DashboardFilterParams) => {
    return apiClient.get<ProcessingMetrics>(ENDPOINTS.DASHBOARD.PROCESSING_METRICS, { params });
  },
  
  /**
   * Get compliance overview for publishers
   * @param params Optional filter parameters
   * @returns Promise with compliance overview
   */
  getComplianceOverview: (params?: DashboardFilterParams) => {
    return apiClient.get<ComplianceOverview>(ENDPOINTS.DASHBOARD.COMPLIANCE_OVERVIEW, { params });
  },
  
  /**
   * Get AI confidence analysis data
   * @param params Optional filter parameters
   * @returns Promise with confidence analysis data
   */
  getAIConfidenceData: (params?: DashboardFilterParams) => {
    return apiClient.get<AIConfidenceData>(ENDPOINTS.DASHBOARD.AI_CONFIDENCE, { params });
  },
  
  /**
   * Get summary dashboard data (all metrics in one call)
   * @param params Optional filter parameters
   * @returns Promise with all dashboard data
   */
  getDashboardSummary: (params?: DashboardFilterParams) => {
    return apiClient.get(ENDPOINTS.DASHBOARD.SUMMARY, { params });
  },

  /**
   * Get AI bypass analysis data based on a confidence threshold
   * @param threshold The confidence threshold (0-100)
   * @returns Promise with AI bypass analysis data
   */
  getAIBypassAnalysis: (threshold: number | null) => { // Allow threshold to be null
    if (threshold === null) {
      // If threshold is null, perhaps return a default/empty analysis or handle as an error/skip
      // For now, let's assume the component handles null threshold by not calling this
      // or the backend can handle a null threshold parameter gracefully (e.g., by returning empty data).
      // Alternatively, prevent call if null in component.
      // For this service, we'll proceed with the call if not null.
      return Promise.resolve({ data: { humanAiAgreementRate: 0, flagsAboveThresholdPercentage: 0, totalFlagsConsideredForAgreement: 0, totalFlagsAboveThreshold: 0 } } as any); // Mock empty response for null
    }
    return apiClient.get<AIBypassAnalysisData>(ENDPOINTS.DASHBOARD.AI_BYPASS_ANALYSIS, { 
      params: { threshold } 
    });
  },

  /**
   * Set or clear the AI bypass settings for the organization.
   * @param payload Object containing the new threshold and action settings.
   *                Set threshold to null to clear/disable settings.
   * @returns Promise with success message and optionally the updated settings.
   */
  setAIBypassThreshold: (payload: SetAIBypassThresholdPayload) => {
    return apiClient.post<SetAIBypassThresholdResponse>(ENDPOINTS.SYSTEM_SETTINGS.AI_BYPASS_THRESHOLD, payload);
  },

  /**
   * Get the current AI bypass settings for the organization.
   * @returns Promise with the current AI bypass settings.
   */
  getAiBypassSettings: () => {
    return apiClient.get<AIBypassSettingsData>(ENDPOINTS.SYSTEM_SETTINGS.AI_BYPASS_SETTINGS);
  },

  /**
   * Revert the last batch of AI auto-processed flags.
   * @returns Promise with success message and count of reverted flags.
   */
  revertLastAiBypassBatch: () => {
    return apiClient.post<RevertAIBypassResponse>(ENDPOINTS.SYSTEM_SETTINGS.REVERT_AUTO_BYPASS);
  }
};

export default dashboardService;
