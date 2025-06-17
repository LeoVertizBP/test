import { Router, Request, Response, NextFunction } from 'express';
import * as organizationService from '../services/organizationService';
import { authenticateToken } from '../middleware/authMiddleware';
import * as jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler';

// Define payload type again here or import from a shared types file later
interface DecodedPayload extends jwt.JwtPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

const router = Router();

// --- Routes for Organizations ---
// Apply authenticateToken middleware individually and use .then/.catch(next)

// GET /api/organizations - Retrieve all organizations
router.get('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    // TODO: Add authorization check
    const organizations = await organizationService.getAllOrganizations();
    res.status(200).json(organizations);
}));

// GET /api/organizations/:id - Retrieve a single organization by ID
router.get('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Add authorization check
    const organization = await organizationService.getOrganizationById(id);
    
    if (!organization) {
        return res.status(404).json({ message: 'Organization not found.' });
    }
    
    res.status(200).json(organization);
}));

// POST /api/organizations - Create a new organization
router.post('/', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { name, settings } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Missing required field: name' });
    }
    
    // TODO: Add authorization check
    const newOrganization = await organizationService.createOrganization({ name, settings });
    res.status(201).json(newOrganization);
}));

// PUT /api/organizations/:id - Update an existing organization
router.put('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    if (Object.keys(updateData).length === 0) {
       return res.status(400).json({ message: 'No update data provided.' });
    }
    
    // TODO: Add authorization check
    try {
        const updatedOrganization = await organizationService.updateOrganization(id, updateData);
        res.status(200).json(updatedOrganization);
    } catch (error) {
        // Handle specific Prisma error for record not found
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Organization not found.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// DELETE /api/organizations/:id - Delete an organization
router.delete('/:id', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    // TODO: Add authorization check
    try {
        await organizationService.deleteOrganization(id);
        res.status(204).send();
    } catch (error) {
        // Handle specific Prisma error for record not found
        if ((error as any)?.code === 'P2025') {
            return res.status(404).json({ message: 'Organization not found.' });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

export default router;
