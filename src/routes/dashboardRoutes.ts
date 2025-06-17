import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import dashboardService from '../services/dashboardService';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(authenticateToken);

/**
 * Parse dashboard filter parameters from query string
 */
const parseDashboardFilters = (req: AuthenticatedRequest) => {
  const filters: any = {};
  
  if (req.query.startDate) {
    filters.startDate = new Date(req.query.startDate as string);
  }
  if (req.query.endDate) {
    filters.endDate = new Date(req.query.endDate as string);
  }
  if (req.query.publisherId) {
    filters.publisherId = req.query.publisherId as string;
  }
  if (req.query.productId) {
    filters.productId = req.query.productId as string;
  }
  if (req.query.advertiserId) {
    filters.advertiserId = req.query.advertiserId as string;
  }
  
  return filters;
};

/**
 * @route   GET /api/dashboard/flag-stats
 * @desc    Get flag statistics for an organization
 * @access  Private
 */
router.get('/flag-stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Organization ID comes from authenticated user (set by authenticateToken middleware)
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const flagStats = await dashboardService.getFlagStats(organizationId, filters);
  
  res.json(flagStats);
}));

/**
 * @route   GET /api/dashboard/violation-stats
 * @desc    Get violation statistics for an organization
 * @access  Private
 */
router.get('/violation-stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const violationStats = await dashboardService.getViolationStats(organizationId, filters);
  
  res.json(violationStats);
}));

/**
 * @route   GET /api/dashboard/ai-stats
 * @desc    Get AI statistics for an organization
 * @access  Private
 */
router.get('/ai-stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const aiStats = await dashboardService.getAIStats(organizationId, filters);
  
  res.json(aiStats);
}));

/**
 * @route   GET /api/dashboard/processing-metrics
 * @desc    Get content processing metrics for an organization
 * @access  Private
 */
router.get('/processing-metrics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const processingMetrics = await dashboardService.getProcessingMetrics(organizationId, filters);
  
  res.json(processingMetrics);
}));

/**
 * @route   GET /api/dashboard/compliance-overview
 * @desc    Get compliance overview for an organization
 * @access  Private
 */
router.get('/compliance-overview', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const complianceOverview = await dashboardService.getComplianceOverview(organizationId, filters);
  
  res.json(complianceOverview);
}));

/**
 * @route   GET /api/dashboard/ai-confidence
 * @desc    Get AI confidence analysis data for an organization
 * @access  Private
 */
router.get('/ai-confidence', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  const aiConfidenceData = await dashboardService.getAIConfidenceData(organizationId, filters);
  
  res.json(aiConfidenceData);
}));

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get all dashboard metrics in a single call
 * @access  Private
 */
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const filters = parseDashboardFilters(req);
  
  // Fetch all metrics in parallel for efficiency
  const [
    flagStats, 
    violationStats, 
    aiStats, 
    processingMetrics, 
    complianceOverview, 
    aiConfidenceData
  ] = await Promise.all([
    dashboardService.getFlagStats(organizationId, filters),
    dashboardService.getViolationStats(organizationId, filters),
    dashboardService.getAIStats(organizationId, filters),
    dashboardService.getProcessingMetrics(organizationId, filters),
    dashboardService.getComplianceOverview(organizationId, filters),
    dashboardService.getAIConfidenceData(organizationId, filters)
  ]);
  
  // Return all data in a single response
  res.json({
    flagStats,
    violationStats,
    aiStats,
    processingMetrics,
    complianceOverview,
    aiConfidenceData
  });
}));

/**
 * @route   GET /api/dashboard/ai-bypass-analysis
 * @desc    Get AI bypass analysis data for an organization based on a threshold
 * @access  Private
 */
router.get('/ai-bypass-analysis', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const thresholdString = req.query.threshold as string;
  if (!thresholdString) {
    return res.status(400).json({ message: 'Threshold query parameter is required.' });
  }

  const threshold = parseInt(thresholdString, 10);
  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    return res.status(400).json({ message: 'Threshold must be a number between 0 and 100.' });
  }

  const aiBypassAnalysisData = await dashboardService.getAIBypassAnalysis(organizationId, threshold);
  res.json(aiBypassAnalysisData);
}));

export default router;
