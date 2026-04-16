const { syncExchangeRates } = require('../services/rateService');
const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');
const { fetchGrossRates } = require('../services/currencyService');

// Mock node-cron to prevent hanging tests
jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

// Mock the dependencies
jest.mock('../config/prisma', () => ({
    rateCache: {
        create: jest.fn(),
        findFirst: jest.fn(),
    },
}));

jest.mock('../config/redisConfig', () => ({
    set: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../services/currencyService', () => ({
    fetchGrossRates: jest.fn(),
}));

describe('syncExchangeRates', () => {

    // The comprehensive nested rates data
    const mockRatesData = {
        "NGN": { "GHS": 0.00824, "ZAR": 0.01216, "USD": 0.00074, "KES": 0.09603 },
        "GHS": { "NGN": 121.39432, "ZAR": 1.47644, "USD": 0.09019, "KES": 11.65702 },
        "ZAR": { "NGN": 82.22116, "GHS": 0.67731, "USD": 0.06109, "KES": 7.89537 },
        "USD": { "NGN": 1345.911, "GHS": 11.0871, "ZAR": 16.3694, "KES": 129.2425 },
        "KES": { "NGN": 10.41384, "GHS": 0.08579, "ZAR": 0.12666, "USD": 0.00774 }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('✅ Success: Should fetch nested API data and persist correctly', async () => {
        fetchGrossRates.mockResolvedValue(mockRatesData);
        prisma.rateCache.create.mockResolvedValue({});
        redisClient.set.mockResolvedValue('OK');

        await syncExchangeRates();

        // Check if API was called
        expect(fetchGrossRates).toHaveBeenCalledTimes(1);

        // Check Postgres persistence (ensuring the nested object is passed)
        expect(prisma.rateCache.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    rates: mockRatesData,
                    baseCurrency: 'GLOBAL'
                })
            })
        );

        // Check Redis update contains the nested values and correct stale status
        const redisCall = redisClient.set.mock.calls[0];
        const payload = JSON.parse(redisCall[1]);

        expect(payload.rates.USD.NGN).toBe(1345.911);
        expect(payload.stale).toBe(false);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sync Complete'));
    });

    test('⚠️ Fallback: Should use nested rates from Postgres if API fails', async () => {
        fetchGrossRates.mockRejectedValue(new Error('API Down'));

        // Simulate finding the last record in DB with the same structure
        prisma.rateCache.findFirst.mockResolvedValue({ rates: mockRatesData });

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('External API Error'));

        // Verify Redis update uses DB data and marks it as stale
        const redisCall = redisClient.set.mock.calls[0];
        const payload = JSON.parse(redisCall[1]);

        expect(payload.rates.GHS.NGN).toBe(121.39432);
        expect(payload.stale).toBe(true);
    });

    test('❌ Failure: Should log critical error if both sources are empty', async () => {
        fetchGrossRates.mockRejectedValue(new Error('API Down'));
        prisma.rateCache.findFirst.mockResolvedValue(null);

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Critical: No rate data found'));
        expect(redisClient.set).not.toHaveBeenCalled();
    });

    test('🚨 Persistence Error: Should catch errors during DB/Redis write', async () => {
        fetchGrossRates.mockResolvedValue(mockRatesData);
        prisma.rateCache.create.mockRejectedValue(new Error('Database Timeout'));

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Persistence Failure'),
            expect.any(Error)
        );
    });
});