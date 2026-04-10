require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { generateToken } = require('../middleware/jwt');

describe('Product Management Integration Tests', () => {
    let merchantOneToken, merchantTwoToken, customerToken;
    let merchantOne, productOneId;

    beforeAll(async () => {
        // Cleanup
        await prisma.product.deleteMany();
        await prisma.user.deleteMany({ where: { email: { contains: '@product-test.com' } } });

        const hashedPassword = await bcrypt.hash('password', 12);

        // Seed Users
        merchantOne = await prisma.user.create({
            data: { fullName: "M1", email: "m1@product-test.com", passwordHash: hashedPassword, role: "merchant", country: "NG", baseCurrency: "NGN" }
        });
        const merchantTwo = await prisma.user.create({
            data: { fullName: "M2", email: "m2@product-test.com", passwordHash: hashedPassword, role: "merchant", country: "GH", baseCurrency: "GHS" }
        });
        const customer = await prisma.user.create({
            data: { fullName: "C1", email: "c1@product-test.com", passwordHash: hashedPassword, role: "customer", country: "NG", baseCurrency: "NGN" }
        });

        merchantOneToken = generateToken({ id: merchantOne.id, role: 'merchant' });
        merchantTwoToken = generateToken({ id: merchantTwo.id, role: 'merchant' });
        customerToken = generateToken({ id: customer.id, role: 'customer' });
    });

    describe('POST /products', () => {
        test('✅ Merchant can create a product', async () => {
            const res = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${merchantOneToken}`)
                .send({
                    name: "Test Phone",
                    price: 500,
                    category: "Electronics"
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.currency).toBe("NGN"); // Inherited from merchantOne
            productOneId = res.body.data.id;
        });

        test('❌ Customer cannot create a product', async () => {
            const res = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: "Illegal", price: 10 });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('GET /products', () => {
        test('✅ Can filter products by category', async () => {
            const res = await request(app).get('/api/products?category=Electronics');
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        test('✅ Can convert price to GHS', async () => {
            const res = await request(app).get(`/api/products/${productOneId}?currency=GHS`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.currency).toBe("GHS");
            // If cache was used in your service, check for:
            // expect(res.body.data).toHaveProperty('isStale');
        });
    });

    describe('PUT & DELETE /api/products/:id', () => {
        test('❌ Merchant Two cannot update Merchant One product', async () => {
            const res = await request(app)
                .put(`/api/products/${productOneId}`)
                .set('Authorization', `Bearer ${merchantTwoToken}`)
                .send({ name: "Hacked" });

            expect(res.statusCode).toBe(403);
        });

        test('✅ Merchant can soft-delete their own product', async () => {
            const res = await request(app)
                .delete(`/api/products/${productOneId}`)
                .set('Authorization', `Bearer ${merchantOneToken}`);

            expect(res.statusCode).toBe(200);

            // Verify it is no longer visible in GET
            const check = await request(app).get(`/api/products/${productOneId}`);
            expect(check.statusCode).toBe(404);
        });
    });
});