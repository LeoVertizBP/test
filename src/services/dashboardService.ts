import { 
  getFlagStatsByOrganization, 
  getViolationStatsByOrganization, 
  getAIStatsByOrganization, 
  getProcessingMetricsByOrganization, 
  getComplianceOverviewByOrganization,
  getAIConfidenceDataByOrganization,
  getAIBypassAnalysisData, // Import the new function
  DashboardFilterParams,
  AIBypassAnalysisData // Import the new interface
} from '../repositories/dashboardRepository';

/**
 * Service for handling dashboard metrics and analytics
 */
class DashboardService {
  /**
   * Get flag statistics for an organization
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher, product)
   */
  async getFlagStats(organizationId: string, filters?: DashboardFilterParams) {
    try {
      console.log('DashboardService.getFlagStats called with:', { organizationId, filters });
      const result = await getFlagStatsByOrganization(organizationId, filters);
      console.log('DashboardService.getFlagStats returning:', result);
      return result;
    } catch (error) {
      console.error('Error getting flag stats:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        organizationId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get violation statistics for an organization
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher, product)
   */
  async getViolationStats(organizationId: string, filters?: DashboardFilterParams) {
    try {
      console.log('DashboardService.getViolationStats called with:', { organizationId, filters });
      const result = await getViolationStatsByOrganization(organizationId, filters);
      console.log('DashboardService.getViolationStats returning:', result);
      return result;
    } catch (error) {
      console.error('Error getting violation stats:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        organizationId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get AI statistics for an organization
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher, product)
   */
  async getAIStats(organizationId: string, filters?: DashboardFilterParams) {
    try {
      return await getAIStatsByOrganization(organizationId, filters);
    } catch (error) {
      console.error('Error getting AI stats:', error);
      throw error;
    }
  }

  /**
   * Get content processing metrics for an organization
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher)
   */
  async getProcessingMetrics(organizationId: string, filters?: DashboardFilterParams) {
    try {
      return await getProcessingMetricsByOrganization(organizationId, filters);
    } catch (error) {
      console.error('Error getting processing metrics:', error);
      throw error;
    }
  }

  /**
   * Get compliance overview for an organization's publishers
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher, product)
   */
  async getComplianceOverview(organizationId: string, filters?: DashboardFilterParams) {
    try {
      console.log('DashboardService.getComplianceOverview called with:', { organizationId, filters });
      const result = await getComplianceOverviewByOrganization(organizationId, filters);
      console.log('DashboardService.getComplianceOverview returning:', result);
      return result;
    } catch (error) {
      console.error('Error getting compliance overview:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        organizationId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get AI confidence analysis data for an organization
   * @param organizationId The organization's ID
   * @param filters Optional filters (date range, publisher, product)
   */
  async getAIConfidenceData(organizationId: string, filters?: DashboardFilterParams) {
    try {
      return await getAIConfidenceDataByOrganization(organizationId, filters);
    } catch (error) {
      console.error('Error getting AI confidence data:', error);
      throw error;
    }
  }

  /**
   * Get AI bypass analysis data for an organization.
   * @param organizationId The organization's ID.
   * @param threshold The AI confidence threshold (0-100).
   * @returns AI bypass analysis data.
   */
  async getAIBypassAnalysis(organizationId: string, threshold: number): Promise<AIBypassAnalysisData> {
    try {
      if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
        throw new Error('Threshold must be a number between 0 and 100.');
      }
      return await getAIBypassAnalysisData(organizationId, threshold);
    } catch (error) {
      console.error('Error getting AI bypass analysis data:', error);
      // Consider re-throwing a more specific error or handling it
      throw error;
    }
  }
}

export default new DashboardService();
