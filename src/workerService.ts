import * as http from 'http';
import { Worker, Job } from 'bullmq';
import redisConnection from './utils/redisClient';
import { AI_BYPASS_QUEUE_NAME, RETROACTIVE_BYPASS_QUEUE_NAME } from './workers/queueRegistry';
import aiBypassProcessor from './workers/aiBypassProcessor';
import retroactiveBypassProcessor from './workers/retroactiveBypassProcessor';

const CONCURRENCY = 5; // Number of jobs to process concurrently per worker

console.log('Starting Worker Service...');

// --- AI Bypass Worker (Post-Scan) ---
const aiBypassWorker = new Worker(
    AI_BYPASS_QUEUE_NAME,
    async (job: Job) => {
        console.log(`[WorkerService] AI Bypass Worker processing job ${job.id} with data:`, job.data);
        try {
            await aiBypassProcessor(job);
            console.log(`[WorkerService] AI Bypass Worker completed job ${job.id}`);
        } catch (error) {
            console.error(`[WorkerService] AI Bypass Worker failed job ${job.id}:`, error);
            throw error; // Important to throw error so BullMQ can handle retries/failure
        }
    },
    {
        connection: redisConnection,
        concurrency: CONCURRENCY,
        removeOnComplete: { count: 1000, age: 24 * 60 * 60 }, // Keep completed jobs for 24 hours
        removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 },    // Keep failed jobs for 7 days
    }
);

aiBypassWorker.on('completed', (job: Job) => {
    console.log(`[AI_BYPASS_QUEUE] Job ${job.id} completed successfully.`);
});

aiBypassWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[AI_BYPASS_QUEUE] Job ${job?.id || 'unknown'} failed:`, err.message, err.stack);
});

aiBypassWorker.on('error', (err: Error) => {
    console.error('[AI_BYPASS_QUEUE] Worker error:', err.message, err.stack);
});

console.log(`AI Bypass Worker listening to queue: ${AI_BYPASS_QUEUE_NAME}`);

// --- Retroactive AI Bypass Worker ---
const retroactiveBypassWorker = new Worker(
    RETROACTIVE_BYPASS_QUEUE_NAME,
    async (job: Job) => {
        console.log(`[WorkerService] Retroactive Bypass Worker processing job ${job.id} with data:`, job.data);
        try {
            await retroactiveBypassProcessor(job);
            console.log(`[WorkerService] Retroactive Bypass Worker completed job ${job.id}`);
        } catch (error) {
            console.error(`[WorkerService] Retroactive Bypass Worker failed job ${job.id}:`, error);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: CONCURRENCY, // Can be lower if these jobs are heavier
        removeOnComplete: { count: 100, age: 7 * 24 * 60 * 60 },
        removeOnFail: { count: 500, age: 30 * 24 * 60 * 60 },
    }
);

retroactiveBypassWorker.on('completed', (job: Job) => {
    console.log(`[RETROACTIVE_BYPASS_QUEUE] Job ${job.id} completed successfully.`);
});

retroactiveBypassWorker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[RETROACTIVE_BYPASS_QUEUE] Job ${job?.id || 'unknown'} failed:`, err.message, err.stack);
});

retroactiveBypassWorker.on('error', (err: Error) => {
    console.error('[RETROACTIVE_BYPASS_QUEUE] Worker error:', err.message, err.stack);
});

console.log(`Retroactive Bypass Worker listening to queue: ${RETROACTIVE_BYPASS_QUEUE_NAME}`);

// ---- ADD HEALTH CHECK SERVER ----
const MODULE_NAME_WS_HEALTH = 'WorkerServiceHealth';

const healthCheckPort = process.env.PORT || 8080; // Cloud Run injects PORT

const healthServer = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
  if (req.url === '/healthz' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

healthServer.listen(healthCheckPort, () => {
  console.log(`[${MODULE_NAME_WS_HEALTH}] Health check server listening on port ${healthCheckPort}`);
});
// ---- END HEALTH CHECK SERVER ----

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down workers...`);
    await Promise.all([
        aiBypassWorker.close(),
        retroactiveBypassWorker.close()
    ]);
    console.log('All workers closed.');
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

console.log('Worker Service started successfully. Waiting for jobs...');
