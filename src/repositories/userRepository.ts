import { users as User, Prisma } from '../../generated/prisma/client';
import prisma from '../utils/prismaClient';

/**
 * Creates a new user in the database.
 * IMPORTANT: Password hashing should be handled in the service layer before calling this function.
 * This function expects a pre-hashed password in the 'password_hash' field.
 * @param data - The data for the new user, matching Prisma's input type. Requires email, name, password_hash, role, organization_id.
 * @returns The newly created user.
 */
export const createUser = async (data: Prisma.usersUncheckedCreateInput): Promise<User> => {
    // Basic validation (can be expanded in service layer)
    if (!data.organization_id || !data.email || !data.name || !data.password_hash || !data.role) {
        throw new Error("Missing required fields for user creation (organization_id, email, name, password_hash, role).");
    }
    // Prisma handles connecting via the foreign key directly with UncheckedCreateInput
    return prisma.users.create({
        data: data,
    });
};

/**
 * Retrieves a single user by their unique ID.
 * @param id - The UUID of the user to retrieve.
 * @returns The user object or null if not found.
 */
export const getUserById = async (id: string): Promise<User | null> => {
    return prisma.users.findUnique({
        where: { id: id },
    });
};

/**
 * Retrieves a single user by their email address.
 * @param email - The email of the user to retrieve.
 * @returns The user object or null if not found.
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
    return prisma.users.findUnique({
        where: { email: email },
    });
};


/**
 * Updates an existing user.
 * IMPORTANT: Password updates require re-hashing in the service layer before calling this function.
 * @param id - The UUID of the user to update.
 * @param data - An object containing the fields to update.
 * @returns The updated user object.
 */
export const updateUser = async (id: string, data: Prisma.usersUpdateInput): Promise<User> => {
    return prisma.users.update({
        where: { id: id },
        data: data,
    });
};

/**
 * Deletes a user by their unique ID.
 * @param id - The UUID of the user to delete.
 * @returns The deleted user object.
 */
export const deleteUser = async (id: string): Promise<User> => {
    return prisma.users.delete({
        where: { id: id },
    });
};

/**
 * Retrieves all users belonging to a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of user objects for the given organization.
 */
export const getUsersByOrganizationId = async (organizationId: string): Promise<User[]> => {
    return prisma.users.findMany({
        where: { organization_id: organizationId }, // Filter by the foreign key
    });
};

/**
 * Updates the last_login timestamp for a user to the current time.
 * @param userId - The UUID of the user to update.
 * @returns The updated user object.
 */
export const updateLastLogin = async (userId: string): Promise<User> => {
    return prisma.users.update({
        where: { id: userId },
        data: { last_login: new Date() }, // Set last_login to the current timestamp
    });
};

// Optional: Disconnect Prisma client
export const disconnectPrisma = async () => {
    await prisma.$disconnect();
};
