import { Router, Response, NextFunction } from 'express'; // Removed Request import as AuthenticatedRequest is used
import * as advertiserService from '../services/advertiserService';
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import AuthenticatedRequest and DecodedPayload
// import * as jwt from 'jsonwebtoken'; // No longer needed here if DecodedPayload is imported
import asyncHandler from '../utils/asyncHandler';

// DecodedPayload is now imported from middleware

const router = Router();

// Apply authentication middleware to all advertiser routes
router.use(authenticateToken);

// --- Routes for Advertisers ---

// GET /api/advertisers - Retrieve advertisers (filtered by organization)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    // TODO: Add authorization check - Ensure user belongs to the requested organization
    // We need the user's organizationId from the token payload
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

    const advertisers = await advertiserService.getAdvertisersByOrganizationId(organizationId);
    res.status(200).json(advertisers);
}));

// GET /api/advertisers/:id - Retrieve a single advertiser by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    // TODO: Add authorization check (user belongs to advertiser's org or is admin)
    const advertiser = await advertiserService.getAdvertiserById(id);
    
    if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found.' });
    }
    // Add check: Ensure user's org matches advertiser's org
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== advertiser.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }
    
    res.status(200).json(advertiser);
}));

// POST /api/advertisers - Create a new advertiser
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { name, settings, default_product_rule_set_id, default_channel_rule_set_id } = req.body;
    const userPayload = req.user; // Use req.user

    if (!name) {
        return res.status(400).json({ message: 'Missing required field: name' });
    }
    if (!userPayload?.organizationId) {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }

    // TODO: Add more specific authorization check (e.g., only admins or specific roles within the org?)

    const advertiserData = {
        name,
        settings,
        default_product_rule_set_id,
        default_channel_rule_set_id,
        organizationId: userPayload.organizationId // Link to user's organization
    };

    const newAdvertiser = await advertiserService.createAdvertiser(advertiserData);
    res.status(201).json(newAdvertiser);
}));

// PUT /api/advertisers/:id - Update an existing advertiser
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }
    // Ensure organizationId is not updated this way
    delete updateData.organizationId;
    delete updateData.organization_id;

    // TODO: Add authorization check (user belongs to advertiser's org or is admin)
    // First, get the advertiser to check ownership
    const advertiser = await advertiserService.getAdvertiserById(id);
    
    if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found.' });
    }
    
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== advertiser.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }

    // If authorized, proceed with update
    try {
        const updatedAdvertiser = await advertiserService.updateAdvertiser(id, updateData);
        res.status(200).json(updatedAdvertiser);
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Advertiser not found during update.' });
        }
        throw error; // Re-throw for the asyncHandler to catch
    }
}));

// DELETE /api/advertisers/:id - Delete an advertiser
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    // TODO: Add authorization check (user belongs to advertiser's org or is admin)
    // First, get the advertiser to check ownership
    const advertiser = await advertiserService.getAdvertiserById(id);
    
    if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found.' });
    }
    
    const userPayload = req.user; // Use req.user
    if (userPayload?.organizationId !== advertiser.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied.' });
    }

    // If authorized, proceed with delete
    try {
        await advertiserService.deleteAdvertiser(id);
        res.status(204).send();
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Advertiser not found during delete.' });
        }
        throw error; // Re-throw for the asyncHandler to catch
    }
}));

// --- Routes for Products (within an advertiser) ---

// GET /api/advertisers/:id/products - Retrieve products for a specific advertiser
router.get('/:id/products', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id: advertiserId } = req.params; // Extract advertiser ID from URL
    const userPayload = req.user;

    // Optional: Add authorization check - Ensure user can access this advertiser's products
    // This might involve checking if the advertiser belongs to the user's organization
    const advertiser = await advertiserService.getAdvertiserById(advertiserId);
    if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found.' });
    }
    if (userPayload?.organizationId !== advertiser.organization_id /* && userPayload?.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Access denied to this advertiser\'s products.' });
    }

    // Fetch products using a new service function (to be created)
    try {
        // We need to add getProductsByAdvertiserId to the service and repository
        const products = await advertiserService.getProductsByAdvertiserId(advertiserId);
        res.status(200).json(products);
    } catch (error) {
        // Log the error for debugging
        console.error(`Error fetching products for advertiser ${advertiserId}:`, error);
        // Send a generic server error response
        res.status(500).json({ message: 'Failed to retrieve advertiser products.' });
    }
}));

// TODO: Add routes for managing advertiser-specific rules? (e.g., GET /:id/rules)

export default router;
