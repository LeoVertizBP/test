import apiClient from '../api/client';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authenticates a user with the given credentials
 * @param credentials User's email and password
 * @returns A promise resolving to the login response with token and user info
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
}

/**
 * Checks if there is a stored authentication token
 * @returns True if an auth token exists in localStorage
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('authToken');
  return !!token;
}

/**
 * Logs out the user by removing the auth token
 */
export function logout(): void {
  localStorage.removeItem('authToken');
}

/**
 * Decodes a JWT token to extract the payload
 * @param token The JWT token to decode 
 * @returns The decoded payload as an object
 */
export function decodeToken(token: string): any {
  try {
    // Split the token into header, payload, signature
    const [, base64Payload] = token.split('.');
    // Decode the base64 payload
    const payload = JSON.parse(atob(base64Payload));
    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}
