import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

// Define a type for the decoded payload
export interface DecodedPayload extends jwt.JwtPayload { // Export this interface
  userId: string;
  email: string;
  role: string;
  organizationId: string;
  publisherId?: string; // Add publisher ID for publisher users
  // Add other expected properties from your JWT payload
}

// Define and export an interface for Requests that have passed authentication
export interface AuthenticatedRequest extends Request {
  user?: DecodedPayload; // Renamed from 'auth' to 'user' for convention
}

// Retrieve the JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1); // Exit if the secret is missing, as the app cannot function securely
}

/**
 * Express middleware to authenticate requests using JWT.
 * Verifies the token from the Authorization header.
 * If valid, attaches the decoded payload to `req.auth`.
 * If invalid or missing, sends an appropriate error response.
 */
// Use the AuthenticatedRequest type for clarity, although attachment is dynamic
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Get token from the Authorization header (format: "Bearer TOKEN")
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token part

  if (token == null) {
    // If no token is present, send 401 Unauthorized
    res.status(401).json({ message: 'Unauthorized: No token provided.' });
    return; // Explicitly return void
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decodedPayload) => {
    if (err) {
      // If token is invalid (e.g., expired, wrong signature), send 403 Forbidden
      console.error("JWT Verification Error:", err.message);
      res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
      return; // Explicitly return void
    }

    // If token is valid, check if the payload is an object before attaching
    if (typeof decodedPayload === 'object' && decodedPayload !== null) {
      // Add debug logging to see full token payload
      console.log("Full decoded token payload:", JSON.stringify(decodedPayload));
      
      // Check for publisherId if role is PUBLISHER and log if it exists
      if ((decodedPayload as any).role === 'PUBLISHER') {
        console.log("Publisher ID in token:", (decodedPayload as any).publisherId);
        console.log("Publisher ID type:", typeof (decodedPayload as any).publisherId);
        
        // Try to convert to string if not already a string
        if ((decodedPayload as any).publisherId && typeof (decodedPayload as any).publisherId !== 'string') {
          (decodedPayload as any).publisherId = String((decodedPayload as any).publisherId);
          console.log("Converted publisherId to string:", (decodedPayload as any).publisherId);
        }
      }
      
      // Attach the decoded payload to the 'user' property
      req.user = decodedPayload as DecodedPayload; // Assign to 'user'
    } else {
      // Handle unexpected payload type (e.g., string) - log an error or reject
      console.error("Unexpected JWT payload type:", typeof decodedPayload);
      res.status(403).json({ message: 'Forbidden: Invalid token payload.' });
      return; // Explicitly return void
    }

    // Proceed to the next middleware or route handler
    next();
  });
};

// Optional: Middleware for checking specific roles (can be added later)
// export const authorizeRole = (allowedRoles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     const authPayload = (req as Request & { auth?: DecodedPayload }).auth;
//     if (!authPayload || !allowedRoles.includes(authPayload.role)) {
//       return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
//     }
//     next();
//   };
// };
