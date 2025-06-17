import { Request, Response, Router, NextFunction } from 'express'; // Import specifics
import * as jwt from 'jsonwebtoken';
import * as userService from '../services/userService';
import { users as UserType } from '../../generated/prisma/client'; // Import user type
import asyncHandler from '../utils/asyncHandler';

const router = Router(); // Initialize directly

// TODO: Move JWT_SECRET to environment variables (.env file) for security!
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY_REPLACE_ME';
const JWT_EXPIRES_IN = '1h'; // Token validity duration

// --- Registration Route ---
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
    // Basic input validation (can be enhanced with libraries like Joi or Zod later)
    const { email, password, name, organization_id } = req.body;

    if (!email || !password || !name || !organization_id) {
        return res.status(400).json({ message: 'Missing required fields: email, password, name, organization_id' });
    }

    // Prepare user data for the service function
    // Note: createUser service function now expects password and org_id directly
    const userDataForService = {
        email,
        name,
        // Pass password directly for the service to handle hashing (if needed, though createUser now auto-generates)
        // If createUser auto-generates, we don't need to pass password here. Let's assume it does based on previous step.
        // password,
        organization_id,
        // role: 'USER' // Optional: explicitly set role if needed
    };


    try {
        // Pass the required fields directly to createUser
        // Assuming createUser now takes an object like: { email, name, role?, organization_id }
        // and handles password generation internally.
        const newUser = await userService.createUser({
            email: userDataForService.email,
            name: userDataForService.name,
            organization_id: userDataForService.organization_id,
            publisher_id: null, // Explicitly set publisher_id to null for non-publisher registration
            // role: userDataForService.role // Pass role if needed, default likely handled by service/db
        });
        // Return the newly created user (without password hash)
        return res.status(201).json(newUser);
    } catch (error) {
        // Handle specific errors
        console.error('Registration error:', error); // Keep logging for debugging
        if (error instanceof Error && error.message.includes('Email address is already in use')) {
            return res.status(409).json({ message: error.message });
        }
        throw error; // Re-throw for asyncHandler to catch
    }
}));

// --- Login Route ---
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Missing required fields: email, password' });
    }

    // Find user by email (service function returns user with password hash)
    const user = await userService.findUserByEmailWithPassword(email);
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password.' }); // Unauthorized
    }

    // Verify the provided password against the stored hash
    const isPasswordValid = await userService.verifyPassword(user.id, password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password.' }); // Unauthorized
    }

    // --- Password is valid - Update last login and Generate JWT ---
    // Update last login timestamp (fire and forget, don't wait for it)
    userService.updateLastLogin(user.id).catch((err: Error) => { // Add type to err
        console.error(`Failed to update last login for user ${user.id}:`, err);
        // Don't block login if this fails, just log the error
    });

    // Create payload for the token (data to embed)
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role, // Include role for potential authorization checks later
        organizationId: user.organization_id,
        // Conditionally add publisherId if the user is a publisher
        ...(user.role === 'PUBLISHER' && user.publisher_id && { publisherId: user.publisher_id })
    };

    // Check if a publisher user is actually linked to a publisher profile
    if (user.role === 'PUBLISHER' && !user.publisher_id) {
        console.warn(`Publisher user ${user.email} (ID: ${user.id}) is not linked to a publisher profile. Login denied.`);
        // Deny login if the publisher user isn't properly configured
        return res.status(403).json({ message: 'Publisher account configuration incomplete. Please contact support.' });
    }

    // Sign the token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Send the token back to the client
    return res.status(200).json({
        message: 'Login successful',
        token: token,
        user: { // Send back user info (excluding password hash) matching UserInfo in AuthContext
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organization_id, // Include organizationId
            // Conditionally include publisherId in the response user object as well
            ...(user.role === 'PUBLISHER' && user.publisher_id && { publisherId: user.publisher_id })
        }
    });
}));

export default router; // Export the router to be used in server.ts
