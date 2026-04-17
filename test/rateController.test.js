const request = require('supertest');
const express = require('express');
const { getLatestRates } = require('../controllers/rateController');
const redisClient = require('../config/redisConfig');
const prisma = require('../config/prisma');

// Setup
const app = express();
app.get('/rates', getLatestRates);

jest.mock('../config/redisConfig');
jest.mock('../config/prisma', () => ({
    rateCache: { findFirst: jest.fn() }
}));

describe('🚀 Comprehensive API Endpoint: GET /rates', () => {

    const mockRates = {
        "USD": { "NGN": 1345.91, "KES": 129.24 },
        "NGN": { "USD": 0.00074, "KES": 0.096 }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('--- 1. Cache Efficiency (Performance) ---', () => {
        test('should return 200 and valid JSON headers from Redis', async () => {
            const redisPayload = JSON.stringify({
                rates: mockRates,
                fetched_at: new Date().toISOString(),
                stale: false
            });
            redisClient.get.mockResolvedValue(redisPayload);

            const res = await request(app).get('/rates');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/json/);
            expect(res.body.rates.USD.NGN).toBe(1345.91);
            expect(res.body.stale).toBe(false);
            // Optimization Check: Ensure Database was NOT queried
            expect(prisma.rateCache.findFirst).not.toHaveBeenCalled();
        });
    });

    describe('--- 2. Resilience & Self-Healing ---', () => {
        test('should heal Redis cache if it misses but Database has data', async () => {
            // Redis is empty
            redisClient.get.mockResolvedValue(null);
            // Database has data
            const dbDate = new Date();
            prisma.rateCache.findFirst.mockResolvedValue({
                rates: mockRates,
                fetchedAt: dbDate
            });

            const res = await request(app).get('/rates');

            expect(res.status).toBe(200);
            expect(res.body.stale).toBe(true);

            // Critical: Ensure the controller "self-healed" Redis for the next user
            expect(redisClient.set).toHaveBeenCalledWith(
                'rates:global:latest',
                expect.stringContaining('"stale":true')
            );
        });
    });

    describe('--- 3. Edge Cases & Safety ---', () => {
        test('should handle malformed JSON in Redis gracefully', async () => {
            // Simulate corrupted data in Redis
            redisClient.get.mockResolvedValue("not-json-data");

            // It should fall back to DB or return 500
            const res = await request(app).get('/rates');
            expect(res.status).toBe(500);
            expect(res.body.message).toBe('Internal Server Error');
        });

        test('should return 503 Service Unavailable if both sources are empty', async () => {
            redisClient.get.mockResolvedValue(null);
            prisma.rateCache.findFirst.mockResolvedValue(null);

            const res = await request(app).get('/rates');

            expect(res.status).toBe(503);
            expect(res.body.message).toContain('unavailable');
        });
    });

    describe('--- 4. Data Consistency ---', () => {
        test('should maintain floating point precision for small values (e.g., NGN to USD)', async () => {
            const precisionRates = { "NGN": { "USD": 0.000741234 } };
            redisClient.get.mockResolvedValue(JSON.stringify({
                rates: precisionRates,
                stale: false
            }));

            const res = await request(app).get('/rates');

            // Check that decimals aren't rounded or truncated
            expect(res.body.rates.NGN.USD).toBe(0.000741234);
        });
    });
});