import app from './app';
import prisma from './utils/prismaClient'; // Import the prisma client instance
import { monitorActiveScanRuns } from './services/scanJobService';
import { Client as PgClient } from 'pg'; // Import pg Client
import { exec } from 'child_process'; // Import exec

const PORT = process.env.PORT || 3001;

async function testRawPgConnection() {
  console.log('Attempting raw pg client connection test...');
  const pgClient = new PgClient({
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD, // This should be resolved by Cloud Run from secrets
    database: process.env.PGDATABASE || 'airora_staging_db',
    host: process.env.PGHOST, // This is the socket path in Cloud Run
  });

  try {
    await pgClient.connect();
    console.log('RAW PG CLIENT: Successfully connected to PostgreSQL via pg.Client!');
    const res = await pgClient.query('SELECT NOW()');
    console.log('RAW PG CLIENT: Query result (SELECT NOW()):', res.rows[0]);
    await pgClient.end();
    console.log('RAW PG CLIENT: Connection closed.');
    return true;
  } catch (err) {
    console.error('RAW PG CLIENT: Connection error:', err);
    return false;
  }
}

async function checkPrismaConnection() {
  try {
    // Use a simple query that doesn't rely on any specific table existing
    await prisma.$queryRaw`SELECT 1`;
    console.log('Successfully connected to the database via Prisma.');
    return true;
  } catch (error) {
    console.error('Failed to connect to the database via Prisma:', error);
    // Log the DATABASE_URL that Prisma is attempting to use, if possible
    // Type guard for Prisma ClientInitializationError or similar errors
    if (error && typeof error === 'object' && 'clientVersion' in error) {
        console.error(`Prisma Client Version: ${(error as { clientVersion: string }).clientVersion}`);
    } else if (error instanceof Error) {
        console.error(`Error name: ${error.name}, Message: ${error.message}`);
    }
    // Attempt to log the URL from the config if the error is a Prisma connection error
    // This is a bit of a guess, as the actual URL used by the failing engine part is hard to get
    try {
      const { constructDatabaseUrl } = await import('./utils/databaseConfig');
      const urlAttempted = constructDatabaseUrl(); // This will re-run the debug logs from databaseConfig
      console.error(`Database URL constructed by databaseConfig.ts (masked for this log): ${urlAttempted.replace(/:[^:@\/]+@/, ':***MASKED***@')}`);
    } catch (configError) {
      console.error('Could not import or run constructDatabaseUrl from databaseConfig.ts to log attempted URL:', configError);
    }
    return false;
  }
}

async function startServer() {
  console.log('Attempting to start server...');

  await new Promise<void>(resolve => {
    console.log('Listing contents of Cloud SQL socket directory...');
    const socketPathDir = process.env.PGHOST;
    if (!socketPathDir || !socketPathDir.startsWith('/cloudsql/')) {
      console.error('PGHOST is not set or does not look like a Cloud SQL socket path. Skipping ls.');
      resolve();
      return;
    }
    exec(`ls -la ${socketPathDir}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error listing socket directory (${socketPathDir}): ${error.message}`);
      }
      if (stderr) {
        console.error(`Stderr from listing socket directory (${socketPathDir}): ${stderr}`);
      }
      console.log(`Socket directory listing (${socketPathDir}):\n${stdout}`);
      resolve();
    });
  });

  const rawPgConnected = await testRawPgConnection();
  if (!rawPgConnected) {
    console.error('Application shutting down due to raw pg client connection failure during startup check.');
    process.exit(1);
  }
  console.log('Raw pg client connection successful. Proceeding to Prisma check...');

  const prismaConnected = await checkPrismaConnection();

  if (!prismaConnected) {
    console.error('Application shutting down due to database connection failure during startup check.');
    process.exit(1); // Exit if Prisma can't connect
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);

    const MONITORING_INTERVAL_MS = 15 * 1000;
    console.log(`Starting scan run monitoring every ${MONITORING_INTERVAL_MS / 1000} seconds.`);
    
    // Start monitoring *after* ensuring Prisma is connected and server is listening
    // Initial call
    monitorActiveScanRuns().catch(error => {
        console.error("Error during initial scan run monitoring (after server start):", error);
    });

    // Subsequent interval calls
    setInterval(() => {
      monitorActiveScanRuns().catch(error => {
          console.error("Error during scheduled scan run monitoring:", error);
      });
    }, MONITORING_INTERVAL_MS);
  });
}

startServer();
