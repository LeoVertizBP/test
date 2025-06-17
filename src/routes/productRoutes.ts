import { Router, Response, NextFunction } from 'express'; // Removed Request import as AuthenticatedRequest is used
import * as productService from '../services/productService';
import * as advertiserService from '../services/advertiserService'; // Need this to check advertiser org
import { authenticateToken, AuthenticatedRequest, DecodedPayload } from '../middleware/authMiddleware'; // Import AuthenticatedRequest and DecodedPayload
// import * as jwt from 'jsonwebtoken'; // No longer needed here if DecodedPayload is imported
import asyncHandler from '../utils/asyncHandler';

// DecodedPayload is now imported from middleware

const router = Router();

// Apply authentication middleware to all product routes
router.use(authenticateToken);

// --- Routes for Products ---

// GET /api/products - Retrieve products (filtered by advertiser or all for org)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const advertiserId = req.query.advertiserId as string | undefined;
    const userPayload = req.user; // Get user payload from middleware

    if (!userPayload?.organizationId) {
        // This check should ideally happen in middleware, but double-check here
        return res.status(403).json({ message: 'Forbidden: Organization ID missing from token.' });
    }
    const userOrganizationId = userPayload.organizationId;

    let products: any[] = []; // Use specific Product type later

    if (advertiserId) {
        // Fetching for a specific advertiser - verify user org matches advertiser org
        const advertiser = await advertiserService.getAdvertiserById(advertiserId);
        if (!advertiser) {
             return res.status(404).json({ message: 'Advertiser not found.' });
        }
        if (advertiser.organization_id !== userOrganizationId /* && userPayload.role !== 'ADMIN' */) {
             return res.status(403).json({ message: 'Forbidden: Access denied to this advertiser\'s products.' });
        }
        // If authorized, get products for this specific advertiser
        products = await productService.getProductsByAdvertiserId(advertiserId);
    } else {
        // No specific advertiser requested, get all products for the user's organization
        // We need to add getProductsByOrganizationId to the service and repository
        products = await productService.getProductsByOrganizationId(userOrganizationId);
    }

    res.status(200).json(products);
}));

// GET /api/products/:id - Retrieve a single product by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload
    // TODO: Add more robust authorization check (user org must match product's advertiser's org)
    const product = await productService.getProductById(id);
    
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }
    
    res.status(200).json(product);
}));

// POST /api/products - Create a new product
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    // Destructure all expected fields from the body
    const { 
        name, 
        advertiserId, // This is the ID of the advertiser
        primary_issuer, // This should be the name of the advertiser
        fee, 
        marketing_bullets, 
        ruleIds, // Array of rule IDs
        ruleSetIds, // Array of rule set IDs
        // ... any other direct product fields like description, parameters etc.
        description, 
        parameters 
    } = req.body;
    const userPayload = req.user; // Get user payload

    if (!name || !advertiserId) {
        return res.status(400).json({ message: 'Missing required fields: name, advertiserId' });
    }

    // Authorization check: Ensure user belongs to the advertiser's organization
    const advertiser = await advertiserService.getAdvertiserById(advertiserId);
    if (!advertiser) {
        return res.status(404).json({ message: 'Advertiser not found for product creation.' });
    }
    if (!userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Cannot create product for this advertiser.' });
    }

    const productData = {
        name,
        advertiserId, // Pass advertiserId to service for connecting relation
        primary_issuer,
        fee,
        marketing_bullets,
        ruleIds,
        ruleSetIds,
        description,
        parameters
        // Ensure all fields expected by Prisma.productsCreateInput (excluding relations handled by IDs) are included
    };
    const newProduct = await productService.createProduct(productData);
    res.status(201).json(newProduct);
}));

// PUT /api/products/:id - Update an existing product
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const updateData = req.body;
    const userPayload = req.user; // Get user payload
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }

    // Authorization check: Ensure user can update this product (check org)
    const product = await productService.getProductById(id);
    if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
    }
    const advertiser = await advertiserService.getAdvertiserById(product.advertiser_id);
    if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Cannot update this product.' });
    }

    // Ensure advertiserId is not updated this way, handle separately if needed
    delete updateData.advertiserId;

    try {
        const updatedProduct = await productService.updateProduct(id, updateData);
        res.status(200).json(updatedProduct);
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Product not found.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// DELETE /api/products/:id - Delete a product
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => { // Use AuthenticatedRequest
    const { id } = req.params;
    const userPayload = req.user; // Get user payload

    // Authorization check: Ensure user can delete this product (check org)
    const product = await productService.getProductById(id);
    if (!product) {
        // Allow delete even if not found to be idempotent, or return 404? Returning 204 for now.
        return res.status(204).send();
    }
    const advertiser = await advertiserService.getAdvertiserById(product.advertiser_id);
     if (!advertiser || !userPayload || userPayload.organizationId !== advertiser.organization_id /* && userPayload.role !== 'ADMIN' */) {
        return res.status(403).json({ message: 'Forbidden: Cannot delete this product.' });
    }

    try {
        await productService.deleteProduct(id);
        res.status(204).send();
    } catch (error) {
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Product not found.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

export default router;
