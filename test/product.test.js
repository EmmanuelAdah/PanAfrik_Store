const request = require('supertest');
const express = require('express');
const productRoutes = require('../routes/productRouter');

// --- Mocks ---
jest.mock('../config/prisma', () => ({
    product: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    }
}));

jest.mock('../services/uploadImage', () => jest.fn(() => 'http://image.url'));
jest.mock('../utils/validator', () => ({
    validateProduct: jest.fn(() => ({ error: null }))
}));

// --- Flexible Auth Mocking ---
// We create variables that we can change per test case
let mockUser = { id: 'merchant_A', role: 'merchant' };

jest.mock('../middleware/jwt', () => ({
    authenticateToken: (req, res, next) => {
        req.user = mockUser;
        next();
    }
}));

// Initialize App
const app = express();
app.use(express.json());
app.use('/products', productRoutes);

const prisma = require('../config/prisma');

describe('Product Security & Isolation Requirements', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * REQUIREMENT: Role Enforcement
     * Does a customer get 403 when they try to POST /products?
     */
    describe('Role Enforcement (POST /products)', () => {
        it('should return 403 Forbidden when a user with role "customer" tries to create a product', async () => {
            // Switch user to a customer
            mockUser = { id: 'customer_123', role: 'customer' };

            const res = await request(app)
                .post('/products')
                .field('name', 'Illegal Product')
                .field('price', '100');

            // The authorizeRoles('merchant') middleware should catch this
            expect(res.status).toBe(403);
        });

        it('should return 201 Created when a user with role "merchant" creates a product', async () => {
            mockUser = { id: 'merchant_A', role: 'merchant' };

            prisma.user.findUnique.mockResolvedValue({ id: 'merchant_A', baseCurrency: 'USD' });
            prisma.product.create.mockResolvedValue({ id: 'p1', name: 'Valid Product' });

            const res = await request(app)
                .post('/products')
                .field('name', 'Valid Product')
                .field('price', '100');

            expect(res.status).toBe(201);
        });
    });

    /**
     * REQUIREMENT: Merchant Isolation
     * Does merchant A get 403 when they try to PUT /products/:id owned by merchant B?
     */
    describe('Merchant Isolation (PUT /products/:id)', () => {
        it('should return 403 Forbidden when Merchant A tries to update Merchant B\'s product', async () => {
            // Set the current logged-in user to Merchant A
            mockUser = { id: 'merchant_A', role: 'merchant' };

            // Mock Prisma to return a product owned by Merchant B
            prisma.product.findUnique.mockResolvedValue({
                id: 'product_100',
                merchantId: 'merchant_B', // Different owner
                name: 'Merchant B laptop'
            });

            const res = await request(app)
                .put('/products/product_100')
                .send({ name: 'Hacked Name' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied. This is not your product.');
            // Ensure an update was never called
            expect(prisma.product.update).not.toHaveBeenCalled();
        });

        it('should return 200 OK when Merchant A updates their own product', async () => {
            mockUser = { id: 'merchant_A', role: 'merchant' };

            // Mock Prisma to return a product owned by Merchant A
            prisma.product.findUnique.mockResolvedValue({
                id: 'product_100',
                merchantId: 'merchant_A', // Same owner
            });
            prisma.product.update.mockResolvedValue({ id: 'product_100', name: 'Updated' });

            const res = await request(app)
                .put('/products/product_100')
                .send({ name: 'Updated' });

            expect(res.status).toBe(200);
            expect(prisma.product.update).toHaveBeenCalled();
        });
    });

    /**
     * REQUIREMENT: Merchant Isolation (DELETE /products/:id)
     */
    describe('Merchant Isolation (DELETE /products/:id)', () => {
        it('should return 403 when trying to delete a product owned by someone else', async () => {
            mockUser = { id: 'merchant_A', role: 'merchant' };

            prisma.product.findUnique.mockResolvedValue({
                id: 'product_100',
                merchantId: 'merchant_B'
            });

            const res = await request(app).delete('/products/product_100');

            expect(res.status).toBe(403);
            expect(prisma.product.update).not.toHaveBeenCalled();
        });
    });

    describe('POST /products - Validation Logic', () => {

        it('should return 400 if the price is negative (Joi .positive() constraint)', async () => {
            const { validateProduct } = require('../utils/validator');
            // Force the mock to return a specific error for a negative price
            validateProduct.mockReturnValueOnce({
                error: { details: [{ message: '"price" must be a positive number' }] }
            });

            const res = await request(app)
                .post('/products')
                .field('name', 'Cheap Item')
                .field('price', '-10') // Invalid price
                .field('category', 'Test')
                .field('description', 'Test description')
                .attach('image', Buffer.from('fake-image'), 'test.jpg');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('"price" must be a positive number');
        });

        it('should return 400 if the image is missing (Joi .required() constraint)', async () => {
            const { validateProduct } = require('../utils/validator');
            validateProduct.mockReturnValueOnce({
                error: { details: [{ message: 'Product image is required.' }] }
            });

            // Note: No .attach() here
            const res = await request(app)
                .post('/products')
                .field('name', 'Valid Name')
                .field('price', '100')
                .field('category', 'Electronics')
                .field('description', 'Valid description');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Product image is required.');
        });

        it('should pass validation and create product with valid data', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'merchant_123', baseCurrency: 'USD' });
            prisma.product.create.mockResolvedValue({ id: 'new_1', name: 'Valid Product' });

            const res = await request(app)
                .post('/products')
                .field('name', 'Gaming Mouse')
                .field('description', 'High precision sensor with RGB lighting')
                .field('price', '59.99')
                .field('category', 'Electronics')
                .attach('image', Buffer.from('fake-image'), {
                    filename: 'mouse.png',
                    contentType: 'image/png'
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Access Control Requirements', () => {

        it('ROLE ENFORCEMENT: should return 403 for customers', async () => {
            mockUser = { id: 'cust_1', role: 'customer' };

            const res = await request(app)
                .post('/products')
                .field('name', 'Item');

            expect(res.status).toBe(403);
        });

        it('MERCHANT ISOLATION: should return 403 when updating another merchant\'s product', async () => {
            prisma.product.findUnique.mockResolvedValue({
                id: 'prod_99',
                merchantId: 'merchant_B' // Owned by someone else
            });

            const res = await request(app)
                .put('/products/prod_99')
                .send({ name: 'Hack attempt' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('Forbidden');
        });
    });
});