const redisClient = require('../config/redisConfig');
const prisma = require('../config/prisma');
const { syncExchangeRates } = require('../services/rateService');
const logger = require('../utils/logger');

exports.getLatestRates = async (req, res) => {
    const CACHE_KEY = 'rates-cache:global';

    try {
        // Try to fetch from Redis
        const cachedData = await redisClient.get(CACHE_KEY);

        if (cachedData) {
            logger.info('🎯 Serving rates from Redis cache.');
            return res.status(200).json(JSON.parse(cachedData));
        }

        // Fallback: If Redis is empty, try Postgres
        logger.warn('⚠️ Redis cache miss. Falling back to Postgres.');
        const lastKnown = await prisma.rateCache.findFirst({
            orderBy: { fetchedAt: 'desc' }
        });

        if (lastKnown) {
            const fallbackPayload = {
                rates: lastKnown.rates,
                fetched_at: lastKnown.fetchedAt,
                stale: true // Marked as stale because it wasn't in Redis
            };

            // Re-populate Redis so the next request is fast
            await redisClient.set(CACHE_KEY, JSON.stringify(fallbackPayload));

            return res.status(200).json(fallbackPayload);
        }

        // Critical Failure: Trigger emergency sync if absolutely nothing exists
        logger.error('❌ No data in Redis or Postgres. Triggering emergency sync.');
        await syncExchangeRates();

        // Try getting the newly synced data
        const freshData = await redisClient.get(CACHE_KEY);
        if (freshData) {
            return res.status(200).json(JSON.parse(freshData));
        }

        return res.status(503).json({
            message: 'Service temporarily unavailable. Rates are being initialized.',
        });

    } catch (error) {
        logger.error('Unexpected error in getLatestRates controller:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};