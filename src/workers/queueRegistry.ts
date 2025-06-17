import { Queue, Job } from 'bullmq'; // Import Job type
import redisConnection from '../utils/redisClient'; // Assuming a redisClient utility exists

// Define queue names
export const AI_BYPASS_QUEUE_NAME = 'aiBypassQueue';
export const RETROACTIVE_BYPASS_QUEUE_NAME = 'retroactiveBypassQueue';

// Create and export the AI Bypass Queue (for post-scan processing)
// Default job options can be configured here if needed
export const aiBypassQueue = new Queue(AI_BYPASS_QUEUE_NAME, { // Changed from Queue.Queue to Queue
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3, // Number of times to retry a failed job
        backoff: {
            type: 'exponential',
            delay: 1000, // Initial delay in ms
        },
        removeOnComplete: {
            count: 1000, // Keep up to 1000 completed jobs
            age: 24 * 60 * 60, // Keep completed jobs for up to 24 hours
        },
        removeOnFail: {
            count: 5000, // Keep up to 5000 failed jobs
            age: 7 * 24 * 60 * 60, // Keep failed jobs for up to 7 days
        },
    },
});

// Create and export the Retroactive AI Bypass Queue
export const retroactiveBypassQueue = new Queue(RETROACTIVE_BYPASS_QUEUE_NAME, { // Changed from Queue.Queue to Queue
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2, // Fewer attempts for a manually triggered, potentially long-running job
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: {
            count: 100,
            age: 7 * 24 * 60 * 60, // Keep for 7 days
        },
        removeOnFail: {
            count: 500,
            age: 30 * 24 * 60 * 60, // Keep for 30 days
        },
    },
});

// Optional: Function to log queue events for monitoring
// Explicitly type the queue parameter with <any, any, string> for Job data, result, and name types
const logQueueEvents = (queue: Queue<any, any, string>) => {
    queue.on('error' as any, (error: Error) => { // Cast event name to any
        console.error(`BullMQ Queue ${queue.name} Error:`, error);
    });
    queue.on('waiting' as any, (jobId: string) => { // Cast event name to any
        // console.log(`Job ${jobId} is waiting in ${queue.name}`);
    });
    queue.on('active' as any, (job: Job) => { // Cast event name to any
        // console.log(`Job ${job.id} is active in ${queue.name}`);
    });
    queue.on('completed' as any, (job: Job, result: any) => { // Cast event name to any
        // console.log(`Job ${job.id} completed in ${queue.name} with result:`, result);
    });
    queue.on('failed' as any, (job: Job | undefined, err: Error) => { // Cast event name to any
        console.error(`Job ${job?.id || 'N/A'} failed in ${queue.name}:`, err);
    });
    queue.on('stalled' as any, (jobId: string) => { // Cast event name to any
        console.warn(`Job ${jobId} has stalled in ${queue.name}`);
    });
};

logQueueEvents(aiBypassQueue);
logQueueEvents(retroactiveBypassQueue);

console.log(`BullMQ Queues (${AI_BYPASS_QUEUE_NAME}, ${RETROACTIVE_BYPASS_QUEUE_NAME}) initialized.`);

// It's also common to initialize Workers here or in a separate worker setup file.
// For now, we'll just define the queues. Worker registration will happen where workers are run.
