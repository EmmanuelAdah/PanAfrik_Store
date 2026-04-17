const request = require('supertest');
const express = require('express');
const { checkOut, getOrderDetails, getOrders } = require('../controllers/orderController');
const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const rateLimit = require('express-rate-limit');

// 1. Setup App Environment
const app = express();
app.use(express.json());

const checkoutLimiter = rateLimit({
    windowMs: 60000,
    max: 5,
    handler: (req, res) => res.status(429).json({ message: "Rate limit exceeded" })
});

const withAuth = (id, role) => (req, res, next) => {
    req.user = { id, role };
    next();
};

// Routes
app.post('/checkout', withAuth('cust-123', 'customer'), checkoutLimiter, checkOut);
app.get('/orders/:id', withAuth('cust-123', 'customer'), getOrderDetails);
app.get('/orders', withAuth('merch-456', 'merchant'), getOrders);

// 2. Mocks
jest.mock('../config/prisma', () => ({
    $transaction: jest.fn(cb => cb(require('../config/prisma'))),
    cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    orderItem: { create: jest.fn() },
    payoutNotification: { create: jest.fn() },
    rateCache: { findFirst: jest.fn() }
}));
jest.mock('../config/redisConfig', () => ({ get: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));

describe('📦 Order System Integration Tests', () => {

    const mockRateData = {
        rates: {
            "NGN": { "USD": 1343.2834, "GHS": 121.00017 },
            "USD": { "NGN": 0.00074 }
        }
    };

    const mockCart = [
        {
            quantity: 2,
            product: { id: 'p1', price: 50.00, currency: 'USD', merchantId: 'merch-456', name: 'Gadget' }
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('💰 POST /checkout - Currency Logic', () => {
        test('✅ Success: Calculate NGN total for USD products correctly', async () => {
            prisma.cartItem.findMany.mockResolvedValue(mockCart);
            redisClient.get.mockResolvedValue(JSON.stringify(mockRateData));
            prisma.order.create.mockResolvedValue({ id: 'ord-1' });
            prisma.order.update.mockResolvedValue({ id: 'ord-1', customerTotal: 134328.34, status: 'completed' });

            const res = await request(app)
                .post('/checkout')
                .send({ customerCurrency: 'NGN' });

            expect(res.status).toBe(201);
            // (50 USD * 1343.2834 NGN/USD) * 2 qty = 134328.34
            expect(res.body.order.customerTotal).toBe(134328.34);

            // Verify Payout Notification creation
            expect(prisma.payoutNotification.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ amount: 100.00, currency: 'USD' })
            }));
        });
    });

    describe('🧱 Transactional Integrity', () => {
        test('🛑 should NOT clear cart if order update fails', async () => {
            prisma.cartItem.findMany.mockResolvedValue(mockCart);
            redisClient.get.mockResolvedValue(JSON.stringify(mockRateData));
            prisma.order.create.mockResolvedValue({ id: 'ord-fail' });

            // Simulate a crash during the update
            prisma.order.update.mockRejectedValue(new Error("Update Failed"));

            const res = await request(app)
                .post('/checkout')
                .send({ customerCurrency: 'NGN' });

            expect(res.status).toBe(500);
            // Cart deletion happens at the END of the transaction. If the update fails, this shouldn't run.
            expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
        });
    });

    describe('🔒 Rate Limiting', () => {
        test('⚠️ should return 429 after 5 rapid requests', async () => {
            // Fill the quota
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/checkout')
                    .send({ customerCurrency: 'NGN' });
            }
            // The 6th request
            const res = await request(app)
                .post('/checkout')
                .send({ customerCurrency: 'NGN' });

            expect(res.status).toBe(429);
            expect(res.body.message).toBe("Rate limit exceeded");
        });
    });

    describe('🛡️ GET /orders/:id - Access Control', () => {
        test('🚫 should return 403 if a stranger accesses an order', async () => {
            // User is 'cust-123', Order belongs to 'someone-else'
            prisma.order.findUnique.mockResolvedValue({
                customerId: 'someone-else',
                orderItems: [{ merchantId: 'merch-999' }]
            });

            const res = await request(app).get('/orders/ord-999');
            expect(res.status).toBe(403);
        });

        test('✅ should allow a merchant to view an order containing their product', async () => {
            const merchApp = express();
            merchApp.get('/orders/:id', withAuth('merch-456', 'merchant'), getOrderDetails);

            prisma.order.findUnique.mockResolvedValue({
                customerId: 'cust-123',
                orderItems: [{ merchantId: 'merch-456' }] // Matching ID
            });

            const res = await request(merchApp).get('/orders/ord-999');
            expect(res.status).toBe(200);
        });
    });
});