import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize the Express application
const app = express();

// Middleware setup
// Load FRONTEND_URL from environment variables
const deployedFrontendUrl = process.env.FRONTEND_URL;
const localDevelopmentUrl = 'http://localhost:3000';

let allowedOrigins = [];

if (deployedFrontendUrl) {
  allowedOrigins.push(deployedFrontendUrl);
} else {
  console.warn('WARN: FRONTEND_URL environment variable not set. CORS origin for deployed frontend might be incorrect.');
}

// Always allow local development URL for convenience,
// but in a stricter production setup, this might be conditional (e.g., based on NODE_ENV)
allowedOrigins.push(localDevelopmentUrl);

// If FRONTEND_URL was not set and we only have localDevelopmentUrl,
// and for some reason localDevelopmentUrl was also undefined (it's hardcoded here, but for safety),
// we might fall back to a single default or log a more critical error.
// For now, if allowedOrigins is empty, cors might default to '*' or fail, let's ensure it has at least one.
if (allowedOrigins.length === 0) {
    console.warn('WARN: No CORS origins could be determined. Defaulting to allow only local development URL.');
    allowedOrigins = [localDevelopmentUrl]; // Fallback just in case
}

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // Allow requests with credentials (like cookies, auth headers)
}));

// Parse incoming requests with JSON payloads
app.use(express.json());

// Define a simple root route for testing
app.get('/', (req: Request, res: Response) => {
  res.send('Compliance Tool API is running!');
});

// Import route handlers
import authRoutes from './routes/authRoutes';
// import publisherAuthRoutes from './routes/publisherAuthRoutes'; // Removed - Using unified auth
import organizationRoutes from './routes/organizationRoutes';
import productRoutes from './routes/productRoutes';
import advertiserRoutes from './routes/advertiserRoutes';
import publisherRoutes from './routes/publisherRoutes';
import productRuleRoutes from './routes/productRuleRoutes';
import channelRuleRoutes from './routes/channelRuleRoutes';
import ruleSetRoutes from './routes/ruleSetRoutes';
import scanJobRoutes from './routes/scanJobRoutes'; // Import scan job routes
import flagRoutes from './routes/flagRoutes'; // Import flag routes
import dashboardRoutes from './routes/dashboardRoutes'; // Import dashboard routes
import userRoutes from './routes/userRoutes'; // Import user routes
import platformRoutes from './routes/platformRoutes'; // Import platform routes
import screenshotRoutes from './routes/screenshotRoutes'; // Import screenshot routes
import systemSettingsRoutes from './routes/systemSettingsRoutes'; // Import system settings routes
import contentProxyRoutes from './routes/contentProxyRoutes'; // Import content proxy routes
import mediaAccessRoutes from './routes/mediaAccessRoutes'; // Import media access routes

// --- Mount Routers ---
// Use the authentication routes for any requests starting with /api/auth
app.use('/api/auth', authRoutes); // Handles both regular and publisher login now
// Use the organization routes for any requests starting with /api/organizations
app.use('/api/organizations', organizationRoutes);
// Use the product routes for any requests starting with /api/products
app.use('/api/products', productRoutes);
// Use the advertiser routes for any requests starting with /api/advertisers
app.use('/api/advertisers', advertiserRoutes);
// Use the publisher routes for any requests starting with /api/publishers
app.use('/api/publishers', publisherRoutes);
// Use the product rule routes for any requests starting with /api/product-rules
app.use('/api/product-rules', productRuleRoutes);
// Use the channel rule routes for any requests starting with /api/channel-rules
app.use('/api/channel-rules', channelRuleRoutes);
// Use the rule set routes for any requests starting with /api/rule-sets
app.use('/api/rule-sets', ruleSetRoutes);
// Use the scan job routes for any requests starting with /api/scan-jobs
app.use('/api/scan-jobs', scanJobRoutes);
// Use the flag routes for any requests starting with /api/flags
app.use('/api/flags', flagRoutes);
// Use the dashboard routes for any requests starting with /api/dashboard
app.use('/api/dashboard', dashboardRoutes);
// Use the user routes for any requests starting with /api/users
app.use('/api/users', userRoutes);
// Use the platform routes for any requests starting with /api/v1/platforms
app.use('/api/v1/platforms', platformRoutes);
// Use the screenshot routes for any requests starting with /api/screenshots
app.use('/api/screenshots', screenshotRoutes);
// Use the system settings routes for any requests starting with /api/system-settings
app.use('/api/system-settings', systemSettingsRoutes);
// Use the content proxy routes
app.use('/api/v1/content-proxy', contentProxyRoutes);
// Use the media access routes
app.use('/api/v1/media-access-url', mediaAccessRoutes);


// Centralized error handling middleware (catches errors passed via next())
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("=== UNHANDLED ERROR ===");
  console.error("Request:", req.method, req.url);
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  console.error("Error Stack:", err.stack || 'No stack trace');
  console.error("Request Body:", req.body);
  console.error("Request Query:", req.query);
  console.error("======================");
  
  // Avoid sending detailed error messages in production for security
  res.status(500).json({ message: 'An internal server error occurred.' });
});

export default app; // Export app for use in server.ts and potential testing setups later
