const { createClient } = require('redis');
const logger = require('../utils/logger');

// Render provides a 'REDIS_URL' environment variable by default
const REDIS_URL = process.env.REDIS_URL;

const redisClient = createClient({
    url: REDIS_URL,
    socket: {
        // Essential for Render: it handles restarts/deploys,
        // so your app must reconnect automatically.
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        connectTimeout: 10000
    }
});

redisClient.on('error', (err) => logger.error('Render Redis Error:', err));
redisClient.on('connect', () => logger.info('🚀 Connected to Render Redis'));

(async () => {
    try {
        if (!redisClient.isOpen) await redisClient.connect();
    } catch (err) {
        logger.error('Failed to connect to Render Redis', err);
    }
})();

module.exports = redisClient;