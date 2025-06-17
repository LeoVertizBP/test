import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// TypeScript interfaces
export interface User {
  id: string;
  name: string; // This field will be used for the user's full name or username
  email: string;
  role: string;
  organization_id: string;
  publisher_id?: string; // Optional, if a user can be linked to a publisher
  // Add other fields like first_name, last_name, last_login if they are indeed returned by the backend
  // For now, we stick to the minimal confirmed set.
  first_name?: string; // Assuming API might provide this
  last_name?: string; // Assuming API might provide this
  username?: string; // If distinct from name/email
  last_login?: string | null; // Assuming API might provide this
  status?: string; // e.g., 'active', 'inactive'
}

export interface UserCreatePayload {
  name: string;
  email: string;
  role: string;
  organization_id: string;
  // password field is intentionally omitted here;
  // password creation should ideally be handled by a separate mechanism
  // or set by the user via a confirmation email.
  // If the API expects a password during creation, add it here.
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  // Password updates should be handled carefully, often via a separate endpoint or flow.
  // If direct password update is supported and desired:
  // password?: string;
}


// API service for user operations
export const userService = {
  /**
   * Get all users in the organization
   * @returns Promise with users list
   */
  getAllUsers: () => {
    return apiClient.get<User[]>(ENDPOINTS.USERS);
  },

  /**
   * Get users filtered by specific roles.
   * @param roles Array of roles to filter by (e.g., ['reviewer', 'manager'])
   * @returns Promise with users list
   */
  getUsersByRoles: (roles: string[]) => {
    return apiClient.get<User[]>(ENDPOINTS.USERS, {
      params: { roles: roles.join(',') }
    });
  },

  /**
   * Create a new user.
   * @param userData The data for the new user.
   * @returns Promise with the created user data.
   */
  createUser: (userData: UserCreatePayload) => {
    return apiClient.post<User>(ENDPOINTS.USERS, userData);
  },

  /**
   * Update an existing user.
   * @param userId The ID of the user to update.
   * @param userData The data to update for the user.
   * @returns Promise with the updated user data.
   */
  updateUser: (userId: string, userData: UserUpdatePayload) => {
    return apiClient.put<User>(ENDPOINTS.USER_BY_ID(userId), userData);
  },

  /**
   * Get a single user by their ID.
   * @param userId The ID of the user.
   * @returns Promise with the user data.
   */
  getUserById: (userId: string) => {
    return apiClient.get<User>(ENDPOINTS.USER_BY_ID(userId));
  }
  // Add deleteUser if needed:
  // deleteUser: (userId: string) => {
  //   return apiClient.delete(ENDPOINTS.USER_BY_ID(userId));
  // }
};

export default userService;
