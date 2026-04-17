const { syncExchangeRates } = require('../services/rateService');
const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');
const { fetchGrossRates } = require('../services/currencyService');

// Mock dependencies
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../config/prisma', () => ({
    rateCache: { create: jest.fn(), findFirst: jest.fn() }
}));
jest.mock('../config/redisConfig', () => ({ set: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../services/currencyService', () => ({ fetchGrossRates: jest.fn() }));

describe('syncExchangeRates', () => {
    // This matches the "Received" data you want to handle
    const mockRawRates = {
        "NGN": { "GHS": 0.00826, "ZAR": 0.01221, "USD": 0.00074, "KES": 0.09617 },
        "GHS": { "NGN": 121.00017, "ZAR": 1.47745, "USD": 0.09008, "KES": 11.63645 },
        "ZAR": { "NGN": 81.89804, "GHS": 0.67684, "USD": 0.06097, "KES": 7.87604 },
        "USD": { "NGN": 1343.2834, "GHS": 11.1015, "ZAR": 16.4019, "KES": 129.182 },
        "KES": { "NGN": 10.39838, "GHS": 0.08594, "ZAR": 0.12697, "USD": 0.00774 }
    };

    // This matches what fetchGrossRates() actually returns
    const mockApiResponse = { rates: mockRawRates };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('✅ Success: Should fetch, persist to DB, and set Redis', async () => {
        fetchGrossRates.mockResolvedValue(mockApiResponse);
        prisma.rateCache.create.mockResolvedValue({});
        redisClient.set.mockResolvedValue('OK');

        await syncExchangeRates();

        // Verify Prisma Call
        expect(prisma.rateCache.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                baseCurrency: 'USD',
                rates: mockRawRates, // Correctly checks the nested rates
                fetchedAt: expect.any(Date) // Matches fetchTime
            })
        });

        // Verify Redis Call
        expect(redisClient.set).toHaveBeenCalledWith(
            'rates:global:latest',
            expect.stringContaining('"stale":false'),
            { EX: 3600 }
        );

        const payload = JSON.parse(redisClient.set.mock.calls[0][1]);
        expect(payload.rates.USD.NGN).toBe(1343.2834);
    });

    test('⚠️ Fallback: Should use last known rates from DB when API fails', async () => {
        fetchGrossRates.mockRejectedValue(new Error('Network Error'));
        prisma.rateCache.findFirst.mockResolvedValue({ rates: mockRawRates });

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('External API Error'));

        // Verify it still persists to DB as a NEW record
        expect(prisma.rateCache.create).toHaveBeenCalled();

        // Verify Redis payload is marked as stale
        const payload = JSON.parse(redisClient.set.mock.calls[0][1]);
        expect(payload.stale).toBe(true);
        expect(payload.rates.NGN.GHS).toBe(0.00826);
    });

    test('❌ Critical: Should abort if both API and DB are empty', async () => {
        fetchGrossRates.mockRejectedValue(new Error('API Down'));
        prisma.rateCache.findFirst.mockResolvedValue(null);

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Critical: No rate data found'));
        expect(prisma.rateCache.create).not.toHaveBeenCalled();
        expect(redisClient.set).not.toHaveBeenCalled();
    });

    test('🚨 Persistence Error: Should catch errors during DB write', async () => {
        fetchGrossRates.mockResolvedValue(mockApiResponse);
        prisma.rateCache.create.mockRejectedValue(new Error('DB connection lost'));

        await syncExchangeRates();

        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Persistence Failure'),
            expect.any(Error)
        );
    });
});