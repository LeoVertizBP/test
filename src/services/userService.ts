import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto'; // Import crypto for password generation
import { users as UserType, Prisma } from '../../generated/prisma/client'; // Use actual type 'users' and alias it, import Prisma
import * as userRepository from '../repositories/userRepository';
import prisma from '../utils/prismaClient'; // Assuming shared client exists

const SALT_ROUNDS = 10; // Standard number of salt rounds for bcrypt hashing
const TEMP_PASSWORD_LENGTH = 12; // Length for auto-generated passwords

/**
 * Creates a new user with a hashed password.
 * @param userData - Object containing user details (email, password, name, organizationId).
 * @returns The newly created user object (without password hash).
 * @throws Error if email is already taken.
 */
// Use correct input type based on schema (name, email, role, org_id), remove password requirement
export const createUser = async (userData: Omit<UserType, 'id' | 'created_at' | 'updated_at' | 'password_hash' | 'role' | 'settings' | 'last_login' | 'organization_id'> & { role?: string; organization_id: string }): Promise<Omit<UserType, 'password_hash'>> => {
  // Check if email already exists
  const existingUserByEmail = await userRepository.getUserByEmail(userData.email);
  if (existingUserByEmail) {
    throw new Error('Email address is already in use.');
  }
  // Check if username already exists (if username needs to be unique)
  // const existingUserByUsername = await userRepository.getUserByUsername(userData.username);
  // if (existingUserByUsername) {
  //   throw new Error('Username is already in use.');
  // }

  // Generate a temporary password
  const tempPassword = crypto.randomBytes(TEMP_PASSWORD_LENGTH).toString('hex');
  console.log(`Generated temporary password for ${userData.email}: ${tempPassword}`); // Log for development/testing ONLY! Remove/replace with secure delivery later.

  // Hash the generated password
  const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  // Prepare data for repository, using 'name' field from schema
  const newUserInput: Prisma.usersUncheckedCreateInput = {
    email: userData.email,
    name: userData.name, // Use 'name' field
    password_hash: password_hash,
    role: userData.role || 'USER', // Default role
    organization_id: userData.organization_id,
    // Prisma will handle default values for created_at, updated_at, id, etc.
  };

  // Create user using the repository
  const newUser = await userRepository.createUser(newUserInput);

  // Return the user object without the password hash (using snake_case)
  const { password_hash: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

/**
 * Finds a user by their email address.
 * Includes the password hash for login comparison.
 * @param email - The email address to search for.
 * @returns The user object including password hash, or null if not found.
 */
// Use correct repository function name and type
export const findUserByEmailWithPassword = async (email: string): Promise<UserType | null> => {
  return userRepository.getUserByEmail(email); // Use correct function name
};

/**
 * Finds a user by their ID.
 * Excludes the password hash.
 * @param id - The user ID.
 * @returns The user object without password hash, or null if not found.
 */
// Use correct repository function name and type, destructure correct field
export const findUserById = async (id: string): Promise<Omit<UserType, 'password_hash'> | null> => {
  const user = await userRepository.getUserById(id); // Use correct function name
  if (!user) {
    return null;
  }
  // Exclude password hash before returning (using snake_case)
  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Compares a provided password with the stored hash for a user.
 * @param userId - The ID of the user.
 * @param providedPassword - The password attempt from the user.
 * @returns True if the password matches, false otherwise.
 * @throws Error if the user is not found.
 */
// Use correct repository function name and field name
export const verifyPassword = async (userId: string, providedPassword: string): Promise<boolean> => {
    const user = await userRepository.getUserById(userId); // Use correct function name
    if (!user || !user.password_hash) { // Use snake_case
        throw new Error('User not found or password not set.');
    }
    return bcrypt.compare(providedPassword, user.password_hash); // Use snake_case
};

/**
 * Retrieves all users for a specific organization.
 * @param organizationId - The UUID of the organization.
 * @returns An array of user objects (without password hashes).
 */
export const getUsersByOrganizationId = async (organizationId: string): Promise<Omit<UserType, 'password_hash'>[]> => {
    // We will add the corresponding function to the repository next.
    const users = await userRepository.getUsersByOrganizationId(organizationId);
    // Ensure password hash is removed before returning
    return users.map(({ password_hash, ...user }) => user);
};

/**
 * Updates the last_login timestamp for a user.
 * @param userId - The ID of the user to update.
 */
export const updateLastLogin = async (userId: string): Promise<void> => {
    // We will add the corresponding function to the repository next.
    await userRepository.updateLastLogin(userId);
};


// Potentially add functions for updating user, deleting user, etc. later
