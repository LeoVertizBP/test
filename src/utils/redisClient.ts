import Redis from 'ioredis';

// Configuration for Redis connection
const REDIS_URL = process.env.REDIS_URL;

let redisConnection: Redis;

if (REDIS_URL) {
    // If REDIS_URL is provided, ioredis will parse it for host, port, password, etc.
    redisConnection = new Redis(REDIS_URL, {
        // Options specific to URL-based connection, if any, can go here.
        // Generally, ioredis handles URL parsing well.
        // Keep BullMQ specific options:
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    console.log(`Attempting to connect to Redis using REDIS_URL: ${REDIS_URL}`);
} else {
    // Fallback to individual host/port if REDIS_URL is not set (for local dev without URL)
    console.warn('REDIS_URL not set, falling back to REDIS_HOST/REDIS_PORT. This is suitable for local development but not recommended for cloud deployments.');
    const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

    redisConnection = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    console.log(`Attempting to connect to Redis using host: ${REDIS_HOST}, port: ${REDIS_PORT}`);
}

redisConnection.on('connect', () => {
    // For the URL case, ioredis might not expose host/port easily before connection.
    // We can log the fact that connection is established.
    console.log(`Successfully connected to Redis.`);
});

redisConnection.on('error', (err) => {
    console.error('Redis connection error:', err);
});

// Export the client instance directly for BullMQ and other uses
export default redisConnection;
