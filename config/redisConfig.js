const { createClient } = require('redis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;

const redisClient = createClient({
    url: REDIS_URL,
    socket: {
        // This handles reconnections AFTER the initial connection is established
        reconnectStrategy: (retries) => {
            const delay = Math.min(retries * 100, 3000);
            logger.info(`Redis: Reconnecting in ${delay}ms... (Attempt ${retries})`);
            return delay;
        },
        connectTimeout: 10000
    }
});

redisClient.on('error', (err) => logger.error('❌ Redis Error:', err));
redisClient.on('connect', () => logger.info('🚀 Connected to Redis'));
redisClient.on('reconnecting', () => logger.warn('🔄 Redis: Attempting to reconnect...'));

// The logic to handle the "Cold Start" connection
const connectWithRetry = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    } catch (err) {
        logger.error('🔥 Initial Redis connection failed. Retrying in 5s...', err);
        // If the initial connection fails, we manually retry after 5 seconds
        setTimeout(connectWithRetry, 5000);
    }
};

connectWithRetry();

module.exports = redisClient;