import express, { Request, Response, Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import asyncHandler from '../utils/asyncHandler';
import prisma from '../utils/prismaClient';

const router: Router = express.Router();

/**
 * @route GET /users
 * @description Retrieves a list of users, optionally filtered by roles
 * @access Private (Requires authentication)
 * @query { roles?: string } Comma-separated list of roles to filter by (e.g., 'reviewer,manager')
 */
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { roles } = req.query;
    
    try {
        let whereClause = {};
        
        // If roles are specified, filter by them
        if (roles && typeof roles === 'string') {
            const rolesList = roles.split(',').map(role => role.trim());
            whereClause = {
                role: {
                    in: rolesList
                }
            };
        }
        
        const users = await prisma.users.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                organization_id: true,
                publisher_id: true
            },
            orderBy: {
                name: 'asc'
            }
        });
        
        res.status(200).json(users);
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to retrieve users.' });
    }
}));

/**
 * @route GET /users/:id
 * @description Retrieves a specific user by ID
 * @access Private (Requires authentication)
 * @param id The ID of the user to retrieve
 */
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    
    try {
        const user = await prisma.users.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                organization_id: true,
                publisher_id: true
            }
        });
        
        if (!user) {
            return res.status(404).json({ message: `User with ID ${id} not found.` });
        }
        
        res.status(200).json(user);
    } catch (error: any) {
        console.error(`Error fetching user ${id}:`, error);
        res.status(500).json({ message: 'Failed to retrieve user.' });
    }
}));

export default router;
