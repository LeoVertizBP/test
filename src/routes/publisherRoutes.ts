import { Router, Response, NextFunction } from 'express'; // Removed Request import as AuthenticatedRequest is used
import * as publisherService from '../services/publisherService';
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import AuthenticatedRequest and DecodedPayload
import asyncHandler from '../utils/asyncHandler';
import publisherChannelConfigRoutes from './publisherChannelConfigRoutes'; // Import the config routes
import * as configController from '../controllers/publisherChannelConfigController'; // Import the controller for test crawl
import PublisherFlagController from '../controllers/publisherFlagController'; // Import the new flag controller

// DecodedPayload is now imported from middleware

const router = Router();

// Apply authentication middleware to all publisher routes
router.use(authenticateToken);

// --- Routes for Publisher Flag Management ---
// These must be defined BEFORE other routes with path parameters (like /:id) to avoid conflicts

// GET /api/publishers/flags - Retrieve flags assigned to the logged-in publisher (filtered by status)
router.get('/flags', asyncHandler(PublisherFlagController.getFlagsForPublisher));

// POST /api/publishers/flags/:flagId/comments - Add a comment to a specific flag
router.post('/flags/:flagId/comments', asyncHandler(PublisherFlagController.addCommentToFlag));

// PATCH /api/publishers/flags/:flagId/status - Update the status of a specific flag
router.patch('/flags/:flagId/status', asyncHandler(PublisherFlagController.updateFlagStatus));

// --- Routes for Publishers ---

// GET /api/publishers - Retrieve publishers (filtered by organization)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    // TODO: Add authorization check - Ensure user belongs to the requested organization
    const userPayload = req.user; // Use req.user
    if (!userPayload?.organizationId) {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }
    const organizationId = userPayload.organizationId;

    // Optional: Allow filtering by a specific organizationId from query params (if user is admin?)
    // const requestedOrgId = req.query.organizationId as string || organizationId;
    // if (authPayload.role !== 'ADMIN' && requestedOrgId !== organizationId) {
    //     return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    // }

    const publishers = await publisherService.getPublishersByOrganizationId(organizationId);
    res.status(200).json(publishers);
}));

// GET /api/publishers/:id - Retrieve a single publisher by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    
    // Validate publisher ID parameter format
    if (!id || !/^[0-9a-f-]+$/i.test(id)) {
        return res.status(400).json({ message: 'Invalid publisher ID format.' });
    }
    
    // TODO: Add authorization check (user belongs to publisher's org or is admin)
    const publisher = await publisherService.getPublisherById(id);
    
    if (!publisher) {
        return res.status(404).json({ message: 'Publisher not found.' });
    }
    // Add check: Ensure user's org matches publisher's org
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== publisher.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }
    
    res.status(200).json(publisher);
}));

// POST /api/publishers - Create a new publisher
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { name, status, contact_info, settings } = req.body; // Include contact_info
    const userPayload = req.user; // Use req.user

    if (!name || !status) { // Check for name and status
        return res.status(400).json({ message: 'Missing required fields: name, status' });
    }
    if (!userPayload?.organizationId) {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }

    // TODO: Add more specific authorization check

    const publisherData = {
        name,
        status,
        contact_info, // Add contact_info
        settings,
        organizationId: userPayload.organizationId // Link to user's organization
    };

    const newPublisher = await publisherService.createPublisher(publisherData);
    res.status(201).json(newPublisher);
}));

// PUT /api/publishers/:id - Update an existing publisher
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }
    // Ensure organizationId is not updated this way
    delete updateData.organizationId;
    delete updateData.organization_id;

    // TODO: Add authorization check (user belongs to publisher's org or is admin)
    // First, get the publisher to check ownership
    const publisher = await publisherService.getPublisherById(id);
    
    if (!publisher) {
        return res.status(404).json({ message: 'Publisher not found.' });
    }
    
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== publisher.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }

    // If authorized, proceed with update
    try {
        const updatedPublisher = await publisherService.updatePublisher(id, updateData);
        res.status(200).json(updatedPublisher);
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Publisher not found during update.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// DELETE /api/publishers/:id - Delete a publisher
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    // TODO: Add authorization check (user belongs to publisher's org or is admin)
    // First, get the publisher to check ownership
    const publisher = await publisherService.getPublisherById(id);
    
    if (!publisher) {
        return res.status(404).json({ message: 'Publisher not found.' });
    }
    
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== publisher.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }

    // If authorized, proceed with delete
    try {
        await publisherService.deletePublisher(id);
        res.status(204).send();
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Publisher not found during delete.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// --- Routes for Channels (within a publisher) ---

// GET /api/publishers/:id/channels - Retrieve channels for a specific publisher
router.get('/:id/channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id: publisherId } = req.params; // Extract publisher ID from URL
    const userPayload = req.user;

    // Optional: Add authorization check - Ensure user can access this publisher's channels
    // This might involve checking if the publisher belongs to the user's organization
    const publisher = await publisherService.getPublisherById(publisherId);
    if (!publisher) {
        return res.status(404).json({ message: 'Publisher not found.' });
    }
    if (userPayload?.organizationId !== publisher.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied to this publisher\'s channels.' });
    }

    // Fetch channels using a new service function (to be created)
    // Assuming a function like getChannelsByPublisherId exists in publisherService
    try {
        // We need to add getChannelsByPublisherId to the service and repository
        const channels = await publisherService.getChannelsByPublisherId(publisherId);
        res.status(200).json(channels);
    } catch (error) {
        // Log the error for debugging
        console.error(`Error fetching channels for publisher ${publisherId}:`, error);
        // Send a generic server error response
        res.status(500).json({ message: 'Failed to retrieve publisher channels.' });
    }
}));

// POST /api/publishers/:publisherId/channels - Create a new channel for a publisher
router.post('/:publisherId/channels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { publisherId } = req.params;
    const channelData = req.body; // Expects { platform: string, channel_url: string, status: string, ...any other fields }
    const userPayload = req.user;

    if (!channelData.platform || !channelData.channel_url || !channelData.status) {
        return res.status(400).json({ message: 'Missing required fields for channel: platform, channel_url, status' });
    }

    // Authorization: Check if user can modify this publisher
    const publisher = await publisherService.getPublisherById(publisherId);
    if (!publisher) {
        return res.status(404).json({ message: 'Publisher not found.' });
    }
    if (userPayload?.organizationId !== publisher.organization_id) {
        return res.status(403).json({ message: 'Forbidden: Access denied to this publisher.' });
    }

    try {
        const newChannel = await publisherService.createChannelForPublisher(publisherId, channelData);
        res.status(201).json(newChannel);
    } catch (error) {
        console.error(`Error creating channel for publisher ${publisherId}:`, error);
        // Consider more specific error handling based on error types
        res.status(500).json({ message: 'Failed to create publisher channel.' });
    }
}));

// TODO: Add routes for PUT /:id/channels/:channelId, DELETE /:id/channels/:channelId

// --- Specific Route for Test Crawl ---
// POST /api/publishers/:id/channels/:channelId/test-crawl - Run a test crawl simulation
router.post('/:id/channels/:channelId/test-crawl', asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // TODO: Add authorization check similar to GET /channels if needed
    console.log('TEST CRAWL handler (direct route) called with params:', req.params);
    // Directly call the controller function
    configController.runTestCrawl(req, res, next);
}));


// --- Mount Routes for Channel Config (within a specific channel) ---
// This handles routes like /api/publishers/:id/channels/:channelId/config/...
console.log('Mounting publisherChannelConfigRoutes at /:id/channels/:channelId/config');
router.use('/:id/channels/:channelId/config', (req, res, next) => {
  // This middleware only runs for /config routes now
  console.log('Request to config endpoint:', {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    path: req.path
  });
  next();
}, publisherChannelConfigRoutes);


export default router;
