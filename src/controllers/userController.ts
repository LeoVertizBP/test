import { Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/prismaClient';
import asyncHandler from '../utils/asyncHandler';
import { AuthenticatedRequest } from '../middleware/authMiddleware'; // Assuming this type exists for req.user

const SALT_ROUNDS = 10; // Standard salt rounds for bcrypt

interface UserCreateRequestBody {
  name: string;
  email: string;
  role: string;
  organization_id: string;
  password?: string; // Password can be optional if a setup flow exists
}

export const userController = {
  /**
   * Creates a new user.
   * If a password is not provided in the request, a strong random one will be generated.
   * (For a real-world scenario, a password reset/setup flow initiated via email is often preferred over auto-generated passwords).
   */
  createUser: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, email, role, organization_id } = req.body as UserCreateRequestBody;
    let { password } = req.body as UserCreateRequestBody;

    // Basic validation
    if (!name || !email || !role || !organization_id) {
      return res.status(400).json({ message: 'Missing required fields: name, email, role, or organization_id.' });
    }

    // Validate email format (simple regex)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    // Password handling
    let hashedPassword = '';
    if (password) {
      // If a password is provided, hash it
      hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    } else {
      // If no password is provided, generate a secure random one
      // For simplicity, using a basic random string. In production, use a stronger generator.
      const randomPassword = Math.random().toString(36).slice(-12) + 'A1!'; // Example: ensure complexity
      console.log(`No password provided for ${email}. Generated temporary password: ${randomPassword}`); // Log for dev/debug
      hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);
      // Consider sending this password to the user via a secure channel or prompting for a reset.
    }

    try {
      const newUser = await prisma.users.create({
        data: {
          name,
          email,
          role,
          organization_id,
          password_hash: hashedPassword, // Ensure your prisma schema has 'password_hash'
          // Add other default fields if necessary, e.g., status: 'active'
        },
        select: { // Select only non-sensitive fields to return
          id: true,
          name: true,
          email: true,
          role: true,
          organization_id: true,
          publisher_id: true,
          created_at: true,
          updated_at: true,
        },
      });

      res.status(201).json(newUser);
    } catch (error: any) {
      console.error('Error creating user in database:', error);
      // Check for specific Prisma errors, e.g., unique constraint violation (though email check above should catch most)
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return res.status(409).json({ message: 'User with this email already exists (database constraint).' });
      }
      res.status(500).json({ message: 'Failed to create user due to a server error.' });
    }
  }),

  // Placeholder for updateUser - to be implemented if needed
  updateUser: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { name, email, role } = req.body; // Remove status

    // Basic validation
    if (!id) {
        return res.status(400).json({ message: 'User ID is required.' });
    }
    
    // Construct update data, only including fields that are provided
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) {
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }
        updateData.email = email;
    }
    if (role) updateData.role = role;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No update data provided.' });
    }

    // Password update should be handled separately and carefully if needed
    // e.g., if (req.body.password) { updateData.password_hash = await bcrypt.hash(req.body.password, SALT_ROUNDS); }


    try {
        const updatedUser = await prisma.users.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                // status: true, // REMOVE THIS LINE
                organization_id: true,
                publisher_id: true,
                updated_at: true,
            },
        });
        res.status(200).json(updatedUser);
    } catch (error: any) {
        console.error(`Error updating user ${id}:`, error);
        if (error.code === 'P2025') { // Prisma error for record not found
            return res.status(404).json({ message: `User with ID ${id} not found.` });
        }
        if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
            return res.status(409).json({ message: 'Another user with this email already exists.' });
        }
        res.status(500).json({ message: 'Failed to update user.' });
    }
  }),
  
  // Placeholder for deleteUser - to be implemented if needed
  // deleteUser: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  //   // ... implementation ...
  // }),
};

export default userController;
