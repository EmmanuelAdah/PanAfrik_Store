const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');
const { fetchGrossRates } = require('./currencyService');
const cron = require('node-cron');

const syncExchangeRates = async () => {
    let ratesData;
    let isStale = false;
    const fetchTime = new Date();

    try {
        // 1. Attempt fresh fetch from your external provider
        ratesData = await fetchGrossRates();
        logger.info('✅ External rates fetched successfully.');
    } catch (err) {
        // 2. Fallback: If API is down, grab the last known good rates from Postgres
        logger.error('⚠️ External API Error. Falling back to last known rates.');
        isStale = true;

        const lastKnown = await prisma.rateCache.findFirst({
            orderBy: { fetchedAt: 'desc' }
        });
        ratesData = lastKnown ? lastKnown.rates : null;
    }

    if (!ratesData) {
        logger.error('❌ Critical: No rate data found in API or Database.');
        return;
    }

    try {
        // Persist to Postgres (Audit Trail)
        await prisma.rateCache.create({
            data: {
                baseCurrency: 'GLOBAL',
                rates: ratesData,
                fetchedAt: fetchTime
            }
        });

        // Update Redis with the latest rates
        const cachePayload = {
            rates: ratesData,
            fetched_at: fetchTime,
            stale: isStale
        };

        await redisClient.set('rates:global:latest', JSON.stringify(cachePayload));
        logger.info(`🚀 Sync Complete. Redis Updated (Stale: ${isStale})`);

    } catch (err) {
        logger.error('❌ Persistence Failure (Postgres/Redis)', err);
    }
};

// Schedule the task to run every 30 minutes
const initRateCron = async () => {

    // Syntax: (minute) (hour) (day of month) (month) (day of week)
    cron.schedule('*/30 * * * *', async () => {
        logger.info('Timer Triggered: Starting Exchange Rate Sync...');
        try {
            await syncExchangeRates();
        } catch (error) {
            logger.error('CRON Job Failed:', error);
        }
    });
    logger.info('Cron Scheduler initialized: Running every 30 minutes.');
}

module.exports = {
    syncExchangeRates,
    initRateCron
};

