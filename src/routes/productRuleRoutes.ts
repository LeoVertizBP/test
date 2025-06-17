import { Router, Response, NextFunction } from 'express'; // Removed Request import as AuthenticatedRequest is used
import * as productRuleService from '../services/productRuleService';
import * as advertiserService from '../services/advertiserService'; // Need this for auth checks
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import AuthenticatedRequest and DecodedPayload
// import * as jwt from 'jsonwebtoken'; // No longer needed here if DecodedPayload is imported
import asyncHandler from '../utils/asyncHandler';

// DecodedPayload is now imported from middleware

const router = Router();

// Apply authentication middleware to all product rule routes
router.use(authenticateToken);

// --- Routes for Product Rules ---

// GET /api/product-rules - Retrieve product rules (filtered by advertiser or all for org)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const advertiserId = req.query.advertiserId as string | undefined;
    const userPayload = req.user; // Get user payload

    if (!userPayload?.organizationId) {
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }
    const userOrganizationId = userPayload.organizationId;

    let rules: any[] = []; // Use specific Rule type later

    if (advertiserId) {
        // Fetching for a specific advertiser - verify user org matches advertiser org
        const advertiser = await advertiserService.getAdvertiserById(advertiserId);
        if (!advertiser) {
             return res.status(404).json({ message: 'Advertiser not found.' });
        }
        if (advertiser.organization_id !== userOrganizationId /* && userPayload.role !== 'ADMIN' */) {
             return res.status(403).json({ message: 'Forbidden: Access denied to this advertiser\'s product rules.' });
        }
        // If authorized, get rules for this specific advertiser
        rules = await productRuleService.getProductRulesByAdvertiserId(advertiserId);
    } else {
        // No specific advertiser requested, get all product rules for the user's organization
        // We need to add getProductRulesByOrganizationId to the service and repository
        rules = await productRuleService.getProductRulesByOrganizationId(userOrganizationId);
    }

    res.status(200).json(rules);
}));

// GET /api/product-rules/:id - Retrieve a single product rule by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload
    // Add authorization check (user belongs to rule's advertiser's org or is admin)
    const rule = await productRuleService.getProductRuleById(id);
    
    if (!rule) {
        return res.status(404).json({ message: 'Product rule not found.' });
    }

    // Authorization check
    const advertiser = await advertiserService.getAdvertiserById(rule.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Access denied to this product rule.' });
    }

    res.status(200).json(rule);
}));

// POST /api/product-rules - Create a new product rule
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    // Note: The request body uses advertiserId, but the DB schema uses advertiser_id
    const { name, description, rule_type, version, parameters, advertiserId } = req.body;
    const userPayload = req.user; // Get user payload

    if (!name || !description || !rule_type || !version || !advertiserId) {
        return res.status(400).json({ message: 'Missing required fields: name, description, rule_type, version, advertiserId' });
    }

    // Authorization check: Ensure user belongs to the advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(advertiserId);
     if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found for product rule creation.' });
    }
    if (!userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot create product rule for this advertiser.' });
    }

    const ruleData = { name, description, rule_type, version, parameters, advertiserId };

    const newRule = await productRuleService.createProductRule(ruleData);
    res.status(201).json(newRule);
}));

// PUT /api/product-rules/:id - Update an existing product rule
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const updateData = req.body;
    const userPayload = req.user; // Get user payload
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }
    // Ensure advertiserId is not updated this way
    delete updateData.advertiserId;
    delete updateData.advertiser_id;

    // Authorization check: Ensure user is authorized for rule's advertiser
    // First, get the rule to check ownership/authorization
    const rule = await productRuleService.getProductRuleById(id);
    
    if (!rule) {
        return res.status(404).json({ message: 'Product rule not found.' });
    }

    // Check authorization based on advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(rule.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot update this product rule.' });
    }

    // If authorized, proceed with update
    try {
        const updatedRule = await productRuleService.updateProductRule(id, updateData);
        res.status(200).json(updatedRule);
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Product rule not found during update.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// DELETE /api/product-rules/:id - Delete a product rule
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload

    // Authorization check: Ensure user is authorized for rule's advertiser
    // First, get the rule to check ownership/authorization
    const rule = await productRuleService.getProductRuleById(id);
    
    if (!rule) {
        return res.status(404).json({ message: 'Product rule not found.' });
    }

    // Check authorization based on advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(rule.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
         return res.status(403).json({ message: 'Forbidden: Cannot delete this product rule.' });
    }

    // If authorized, proceed with delete
    try {
        await productRuleService.deleteProductRule(id);
        res.status(204).send();
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Product rule not found during delete.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

export default router;
