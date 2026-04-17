const request = require('supertest');
const express = require('express');
const { checkOut, getOrderDetails, getOrders } = require('../controllers/orderController');
const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const rateLimit = require('express-rate-limit');

// Setup App
const app = express();
app.use(express.json());

// Rate Limiter Implementation (Requirement: 5 per user per minute)
const checkoutLimiter = rateLimit({
    windowMs: 60000,
    max: 5,
    handler: (req, res) => res.status(429).json({ message: "Rate limit exceeded" })
});

// Mocking Auth Middleware for different roles
const withAuth = (id, role) => (req, res, next) => {
    req.user = { id, role };
    next();
};

// Routes with specific auth injections
app.post('/checkout', withAuth('cust-123', 'customer'), checkoutLimiter, checkOut);
app.get('/orders/:id', withAuth('some-user', 'customer'), getOrderDetails);
app.get('/orders', withAuth('merch-456', 'merchant'), getOrders);

// Mock Dependencies
jest.mock('../config/prisma', () => ({
    $transaction: jest.fn(cb => cb(require('../config/prisma'))),
    cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    orderItem: { create: jest.fn() },
    rateCache: { findFirst: jest.fn() }
}));
jest.mock('../config/redisConfig');

describe('📦 Comprehensive Checkout & Orders System', () => {

    const mockRate = 0.000741;
    const mockCart = [
        {
            quantity: 2,
            product: { id: 'p1', price: 100.00, currency: 'USD', merchantId: 'merch-456', name: 'Product 1' }
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /checkout (Atomic Processing & Rate Locking)', () => {

        test('🔒 should lock exchange rate and calculate high-precision totals', async () => {
            redisClient.get.mockResolvedValue(JSON.stringify({ rates: { "NGN": { "USD": mockRate } } }));
            prisma.cartItem.findMany.mockResolvedValue(mockCart);
            prisma.order.create.mockResolvedValue({ id: 'ord-999' });

            const res = await request(app)
                .post('/checkout')
                .send({ customerCurrency: 'NGN' });

            expect(res.status).toBe(201);

            // Verify Rate Locking: The exact rate from Redis must be in the DB call
            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ exchangeRateApplied: mockRate })
            }));

            // Verify Merchant Payout: (100.00 * 2) = 200.00
            expect(prisma.orderItem.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ merchantPayoutAmount: 200.00 })
            }));

            // Verify Customer Total: (200.00 / 0.000741) = 269905.53
            expect(prisma.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "ord-999" },
                    data: {
                        customerTotal: 269905.53306,
                        status: 'completed'
                    }
            }));
        });

        test('♻️ should fallback to DB rates if Redis is offline', async () => {
            redisClient.get.mockResolvedValue(null);
            prisma.rateCache.findFirst.mockResolvedValue({ rates: { "NGN": { "USD": 0.0008 } } });
            prisma.cartItem.findMany.mockResolvedValue(mockCart);

            await request(app).post('/checkout').send({ customerCurrency: 'NGN' });

            expect(prisma.rateCache.findFirst).toHaveBeenCalled();
            expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ exchangeRateApplied: 0.0008 })
            }));
        });

         test('🛡️ should enforce 429 Rate Limit after 5 attempts', async () => {
            for(let i=0; i<5; i++) {
                await request(app)
                    .post('/checkout')
                    .send({ customerCurrency: 'NGN' });
            }
            const res = await request(app).post('/checkout').send({ customerCurrency: 'NGN' });
            expect(res.status).toBe(429);
        });
    });

    describe('GET /orders (Role-Based Scoping)', () => {

        test('🚫 should return 403 if a stranger attempts to access an order', async () => {
            // Stranger is 'some-user', Order belongs to 'cust-123'
            prisma.order.findUnique.mockResolvedValue({
                customerId: 'cust-123',
                orderItems: [{ merchantId: 'merch-456' }]
            });

            const res = await request(app).get('/orders/ord-999');
            expect(res.status).toBe(403);
        });

        test('✅ should allow a merchant to see an order they are party to', async () => {
            // Requesting user is 'merch-456' (in app setup)
            // We re-mock the app for this specific test to change the user id
            const merchApp = express();
            merchApp.get('/orders/:id', withAuth('merch-456', 'merchant'), getOrderDetails);

            prisma.order.findUnique.mockResolvedValue({
                customerId: 'cust-123',
                orderItems: [{ merchantId: 'merch-456' }]
            });

            const res = await request(merchApp).get('/orders/ord-999');
            expect(res.status).toBe(200);
        });

        test('📊 should only return orders relevant to the merchant', async () => {
            await request(app)
                .get('/orders');

            expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
                 where: {
                orderItems: { some: { userId: 'merch-456' } }
                },
                include: {
                    orderItems: {
                        where: { userId: 'merch-456' },
                        include: { product: true }
                    }
                },
                orderBy: { createdAt: 'desc'}
            }));
        });
    });

    describe('🛠️ Transactional Integrity', () => {
        test('🛑 should not clear cart if order creation fails', async () => {
            prisma.cartItem.findMany.mockResolvedValue(mockCart);
            prisma.order.create.mockRejectedValue(new Error("DB ERROR"));

            await request(app).post('/checkout').send({ customerCurrency: 'NGN' });

            // Cart deletion should NOT be called because the transaction should abort
            expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
        });
    });
});