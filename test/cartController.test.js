const request = require('supertest');
const express = require('express');
const { addToCart, getCart, removeFromCart } = require('../controllers/cartController');
const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const { validateCart } = require('../utils/validator');

// Mock Dependencies
jest.mock('../config/prisma', () => ({
    product: { findUnique: jest.fn() },
    cartItem: { upsert: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() }
}));
jest.mock('../config/redisConfig', () => ({ get: jest.fn() }));
jest.mock('../utils/logger', () => ({ error: jest.fn(), info: jest.fn() }));
jest.mock('../utils/validator', () => ({ validateCart: jest.fn() }));

const app = express();
app.use(express.json());

// Mock Auth Middleware
app.use((req, res, next) => {
    req.user = { id: 'user-123', baseCurrency: 'NGN' };
    next();
});

// Routes
app.post('/cart', addToCart);
app.get('/cart', getCart);
app.delete('/cart/:itemId', removeFromCart);

describe('🛒 Comprehensive Cart Controller Suite', () => {

    const mockUUID = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /cart (Add Item)', () => {
        test('❌ Should return 400 if validation fails', async () => {
            validateCart.mockReturnValue(false);
            const res = await request(app)
                .post('/cart')
                .send({ quantity: -1 });
            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid cart item data');
        });

        test('❌ Should return 404 if product is inactive or missing', async () => {
            validateCart.mockReturnValue(true);
            prisma.product.findUnique.mockResolvedValue({ id: mockUUID, isActive: false });

            const res = await request(app).post('/cart').send({ productId: mockUUID, quantity: 1 });
            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/inactive/i);
        });

        test('✅ Should upsert item correctly if product is active', async () => {
            validateCart.mockReturnValue(true);
            prisma.product.findUnique.mockResolvedValue({ id: mockUUID, isActive: true });
            prisma.cartItem.upsert.mockResolvedValue({ id: 'cart-1', quantity: 2 });

            const res = await request(app).post('/cart').send({ productId: mockUUID, quantity: 2 });

            expect(res.status).toBe(201);
            expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { unique_user_product: { userId: 'user-123', productId: mockUUID } }
                })
            );
        });
    });

    describe('GET /cart (Fetch & Convert)', () => {
        // Helper to mock the auth middleware behavior
        const mockUser = { id: 'u123', baseCurrency: 'NGN' };

        test('💰 Should correctly calculate totals and convert to NGN', async () => {
            /**
             * The controller uses: unitPrice = rates[merchantCurrency][userCurrency] * price
             * Rate Mock: GHS to NGN = 150.50
             */
            const mockRates = {
                rates: {
                    "GHS": { "NGN": 150.50 },
                    "NGN": { "NGN": 1 }
                },
                fetched_at: new Date().toISOString(),
                stale: false
            };

            redisClient.get.mockResolvedValue(JSON.stringify(mockRates));

            // Mock 2 items
            prisma.cartItem.findMany.mockResolvedValue([
                { id: 'c1', quantity: 2, product: { name: 'Item A', price: 10.00, currency: 'GHS'} }, // 10 * 150.50 = 1505.00
                { id: 'c2', quantity: 1, product: { name: 'Item B', price: 500.00, currency: 'NGN' } } // Same currency, stays 500
            ]);

            // Note: You must ensure your test setup/middleware applies 'mockUser' to 'req.user'
            const res = await request(app)
                .get('/cart')
                .set('user', JSON.stringify(mockUser)); // Adjustment depends on your auth mock strategy

            expect(res.status).toBe(200);
            expect(res.body.currency).toBe('NGN');

            /**
             * Math Check:
             * Item A: (10 * 150.50) * 2 = 3010.00
             * Item B: (500 * 1) * 1     = 500.00
             * Total = 3510.00
             */
            expect(res.body.items[0].unitPriceInBase).toBe(1505.00);
            expect(res.body.items[0].subtotalInBase).toBe(3010.00);
            expect(res.body.total).toBe(3510.00);
        });

        test('🛡️ Should fallback to original price if rates are missing', async () => {
            // Mock Redis returning null (triggering fetchGrossRates or default logic)
            redisClient.get.mockResolvedValue(null);

            // Mocking the scenario where ratesInfo?.rates is undefined
            prisma.cartItem.findMany.mockResolvedValue([
                { id: 'c1', quantity: 1, product: { name: 'Item A', price: 50.00, currency: 'NGN' } }
            ]);

            const res = await request(app).get('/cart');

            expect(res.status).toBe(200);
            // Since currency matches or rates are missing, price should remain unchanged
            expect(res.body.total).toBe(50.00);
        });
    });

    describe('DELETE /cart/:itemId (Remove Item)', () => {
        test('✅ Should delete item if it belongs to the user', async () => {
            prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .delete(`/cart/${mockUUID}`);

            expect(res.status).toBe(204);
            expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
                where: { id: mockUUID, userId: 'user-123' }
            });
        });

        test('❌ Should return 404 if item not found or not owned by user', async () => {
            prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

            const res = await request(app).delete(`/cart/fake-id`);

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('Item not found');
        });
    });

    describe('🔥 Global Error Handling', () => {
        test('Should return 500 if Prisma throws an error', async () => {
            prisma.cartItem.findMany.mockRejectedValue(new Error('DB Crash'));
            const res = await request(app).get('/cart');
            expect(res.status).toBe(500);
        });
    });
});