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
        // Attempt fresh fetch
        ratesData = await fetchGrossRates();
        logger.info('✅ External rates fetched successfully.');
    } catch (err) {
        // Fallback Logic
        logger.error('⚠️ External API Error. Falling back to last known rates.');
        isStale = true;

        const lastKnown = await prisma.rateCache.findFirst({
            orderBy: { fetchedAt: 'desc' }
        });

        if (lastKnown) {
            ratesData = {rates: lastKnown.rates};
        }
    }

    // Global Guard: If even the DB is empty
    if (!ratesData) {
        logger.error('❌ Critical: No rate data found in API or Database.');
        return;
    }

    // console.log(JSON.stringify(ratesData.rates, null, 2));

    try {
        // Persist as a NEW record (even if stale)
        await prisma.rateCache.create({
            data: {
                baseCurrency: 'USD',
                rates: ratesData.rates,
                fetchedAt: fetchTime,
            }
        });

        //  Update Redis with the exact same version
        const cachePayload = {
            rates: ratesData.rates,
            fetched_at: fetchTime,
            stale: isStale
        };

       // Set with a 1-hour expiration
        await redisClient.set(
            'rates-cache:global',
            JSON.stringify(cachePayload),
            { EX: 3600 }
        );
        logger.info(`🚀 Sync Complete. Redis & DB Updated (Stale: ${isStale})`);

    } catch (err) {
        logger.error('❌ Persistence Failure (Postgres/Redis)', err);
    }
};

const initRateCron = () => {
    // Run an initial sync immediately on startup so the cache isn't empty
    syncExchangeRates().catch(err => logger.error('Initial startup sync failed', err));

    cron.schedule('*/30 * * * *', async () => {
        logger.info('Timer Triggered: Starting Exchange Rate Sync...');
        try {
            await syncExchangeRates();
        } catch (error) {
            logger.error('CRON Job Failed:', error);
        }
    }, {
        timezone: "Africa/Lagos"
    });

    logger.info('Cron Scheduler initialized: Running every 30 minutes.');
};

module.exports = {
    syncExchangeRates,
    initRateCron
};