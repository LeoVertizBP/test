import { constructDatabaseUrl } from './databaseConfig'; // Import the function
import { PrismaClient } from '../../generated/prisma/client';

const databaseUrl = constructDatabaseUrl(); // Get the URL
// const databaseUrl = "postgresql://postgres:92Mjtt52Cs33r7L/airora_staging_db?host=/cloudsql/ai-compliance:us-south1:airora-staging-db-main&sslmode=disable"; // Hardcoded for v13 test (removed @)

if (!databaseUrl) {
  console.error("FATAL: Dynamically constructed database URL is empty or undefined. Check environment variables and databaseConfig.ts.");
  // Optionally, throw an error to prevent the app from starting without a DB URL
  // This is critical for Cloud Run as it might otherwise enter a crash loop without clear logs.
  throw new Error("FATAL: Database URL could not be constructed. Application cannot start.");
} else {
  // Mask the password part of the URL for logging
  // Adjust regex for masking if @ is not present before db name in this format
  const maskedUrl = databaseUrl.replace(/:([^:@\/]+)@\//, ':***MASKED***/').replace(/postgres:([^@\/]+)\//, 'postgres:***MASKED***/'); // Mask both formats
  console.log(`PrismaClient will be initialized with dynamically constructed URL: ${maskedUrl}`);
}

// Create a single instance of the Prisma client to be used throughout the application
// Pass the dynamically constructed URL directly to the PrismaClient constructor
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

export default prisma;
