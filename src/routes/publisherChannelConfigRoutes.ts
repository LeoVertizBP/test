import express, { Router } from 'express';
// Assuming controllers are in ../controllers and follow a naming convention
import * as configController from '../controllers/publisherChannelConfigController';
// Assuming auth middleware exists
import { authenticateToken } from '../middleware/authMiddleware'; // Corrected function name

const router: Router = express.Router({ mergeParams: true }); // mergeParams allows access to :publisherId and :channelId

// Apply authentication middleware to all routes in this file
router.use(authenticateToken); // Corrected function name

// --- Routes for /api/publishers/:publisherId/channels/:channelId/config ---

// Add logging for incoming requests
router.use((req, res, next) => {
  console.log('Inside publisherChannelConfigRoutes - Received request:', {
    method: req.method,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    path: req.path,
    params: req.params
  });
  next();
});

// GET /api/publishers/:id/channels/:channelId/config - Get config for a channel
router.get('/', (req, res, next) => {
  console.log('GET config handler called with params:', req.params);
  configController.getConfig(req, res, next);
});

// POST /api/publishers/:id/channels/:channelId/config - Create config for a channel
router.post('/', (req, res, next) => {
  console.log('POST config handler called with params:', req.params);
  configController.createConfig(req, res, next);
});

// PUT /api/publishers/:id/channels/:channelId/config - Update config for a channel
router.put('/', (req, res, next) => {
  console.log('PUT config handler called with params:', req.params);
  configController.updateConfig(req, res, next);
});

// DELETE /api/publishers/:id/channels/:channelId/config - Delete config for a channel
router.delete('/', (req, res, next) => {
  console.log('DELETE config handler called with params:', req.params);
  configController.deleteConfig(req, res, next);
});

// --- Route for Test Crawl ---

// POST /api/publishers/:id/channels/:channelId/test-crawl - Run a test crawl simulation
router.post('/test-crawl', (req, res, next) => {
  console.log('TEST CRAWL handler called with params:', req.params);
  configController.runTestCrawl(req, res, next);
});


export default router;
