import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CAPTURE_QUEUE_NAME = 'capture'; // Match worker constant name

async function enqueueDomainCapture() { // Rename function for clarity
  const argv = await yargs(hideBin(process.argv))
    .option('publisherId', {
      alias: 'p',
      type: 'string',
      description: 'The UUID of the publisher to scan',
      demandOption: true,
    })
    .option('scanJobId', {
      alias: 's',
      type: 'string',
      description: 'The UUID of the Scan Job to associate with this capture',
      demandOption: true, // Make it required for now
    })
    .option('maxPages', {
       alias: 'm',
       type: 'number',
       description: 'Optional maximum number of pages to capture',
       demandOption: false, // Optional
    })
    .help()
    .alias('help', 'h')
    .strict() // Error on unknown options
    .argv;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('Error: REDIS_URL environment variable is not set.');
    process.exit(1);
  }
  console.log(`Connecting to Redis at: ${redisUrl}`);

  const redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Prevent immediate failure on connection issues
    enableReadyCheck: false, // Recommended for BullMQ
  });

  redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
    // Exit if connection fails initially, BullMQ might handle reconnections later
    // Exit if connection fails initially, BullMQ might handle reconnections later
    // Consider more robust handling if needed
    process.exit(1);
  });

  // No need to explicitly ping, BullMQ handles connection readiness
  // await redisConnection.ping();
  // console.log('Connected to Redis.');

  const captureQueue = new Queue(CAPTURE_QUEUE_NAME, { connection: redisConnection });

  try {
    // Construct payload matching the worker's expected CaptureJobData
    const jobPayload: { publisherId: string; scanJobId: string; maxPages?: number } = {
      publisherId: argv.publisherId,
      scanJobId: argv.scanJobId,
    };
    if (argv.maxPages !== undefined) {
        jobPayload.maxPages = argv.maxPages;
    }

    const job = await captureQueue.add('captureDomain', jobPayload); // Use new job name and payload
    console.log(`Successfully enqueued job ${job.id} for Publisher ID: ${argv.publisherId}, Scan Job ID: ${argv.scanJobId}${argv.maxPages ? `, Max Pages: ${argv.maxPages}` : ''}`);

  } catch (error) {
    console.error('Error enqueuing job:', error);
    // Consider setting exit code 1 on error
  } finally {
    // Close connections gracefully
    await captureQueue.close();
    await redisConnection.quit();
    console.log('Redis connection closed.');
  }
}

enqueueDomainCapture().catch((error) => { // Call renamed function
  console.error('Unhandled error in enqueue script:', error);
  process.exit(1);
});
