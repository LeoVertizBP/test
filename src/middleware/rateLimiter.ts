import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import * as logger from '../utils/logUtil';

dotenv.config();

const MODULE_NAME = 'RateLimiter';

// Default values
const DEFAULT_RATE_MINUTES = 1; // Window size in minutes
const DEFAULT_SHOT_RATE_PER_MIN = 5; // Default requests per window per key

// Read rate limit from environment variables, using defaults if not set
const rateLimitWindowMs = DEFAULT_RATE_MINUTES * 60 * 1000; // Convert minutes to milliseconds
const maxRequestsPerWindow = parseInt(process.env.SHOT_RATE_PER_MIN || `${DEFAULT_SHOT_RATE_PER_MIN}`, 10);

if (isNaN(maxRequestsPerWindow) || maxRequestsPerWindow <= 0) {
    logger.warn(MODULE_NAME, `Invalid SHOT_RATE_PER_MIN value "${process.env.SHOT_RATE_PER_MIN}". Using default: ${DEFAULT_SHOT_RATE_PER_MIN}`);
}

logger.info(MODULE_NAME, `Configuring rate limiter: Max ${maxRequestsPerWindow} requests per ${DEFAULT_RATE_MINUTES} minute(s) per key.`);

// Configure the rate limiter
export const screenshotRateLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    max: maxRequestsPerWindow,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { // Custom message for 429 response
        status: 429,
        error: 'Too many screenshot requests created from this IP, please try again after a minute.',
    },
    // Key generator function (uses IP address by default, which is suitable for container-wide limit)
    // keyGenerator: (req, res) => {
    //   // Example: Key by IP + orgId if needed later
    //   // const orgId = req.user?.organizationId || 'anonymous'; // Assuming user info is attached to req
    //   // return `${req.ip}-${orgId}`;
    //   return req.ip; // Default behavior
    // },
    handler: (req, res, next, options) => {
        logger.warn(MODULE_NAME, `Rate limit exceeded for IP: ${req.ip}. Path: ${req.path}`);
        res.status(options.statusCode).send(options.message);
    },
    skip: (req, res) => {
        // Potentially skip rate limiting for specific conditions if needed
        // e.g., if (req.user?.isAdmin) return true;
        return false;
    },
});
