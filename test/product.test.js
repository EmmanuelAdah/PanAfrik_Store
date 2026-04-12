require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcrypt');
const path = require('path');
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

    afterAll(async () => {
        await prisma.$disconnect();
    })

    describe('POST /products', () => {
        test('✅ Merchant can create a product with an image upload', async () => {

            const imagePath = path.join(__dirname, 'fixtures/fan.jpg');

            const res = await request(app)
                .post('/products') // Ensure this matches your app.use prefix
                .set('Authorization', `Bearer ${merchantOneToken}`)
                .field('name', 'Standing Fan')
                .field('price', 5000)
                .field('category', 'Electronics')
                .field('description', 'White Binatone standing fan')
                .attach('image', imagePath);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('imageUrl');
            expect(res.body.data.imageUrl).toContain('cloudinary.com');
            expect(res.body.data.currency).toBe("NGN");

            productOneId = res.body.data.id;
        });

        test('✅ Should create product with image upload', async () => {
            const res = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${ merchantOneToken }`)
                .field('name', 'Nokia G20')
                .field('price', 85000)
                .field('description', 'A smartphone with 8GB RAM')
                .field('category', 'Phones')
                .attach('image', 'test/fixtures/phone.png'); // Ensure this file exists!

            expect(res.statusCode).toBe(201);
            expect(res.body.data.imageUrl).toContain('cloudinary.com');
        });

        test('❌ Customer cannot create a product', async () => {
            const res = await request(app)
                .post('/products')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ name: "Illegal", price: 10 });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Product Validation Tests', () => {
    test('❌ Should fail if image is missing', async () => {
        const res = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${merchantToken}`)
            .field('name', 'No Image Phone')
            .field('price', '500');

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Product image is required.');
    });

    test('❌ Should fail if price is negative', async () => {
        const res = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${merchantToken}`)
            .field('name', 'Cheap Phone')
            .field('price', '-10')
            .attach('image', 'test/fixtures/phone.png');

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('Price must be a positive number');
    });

    test('❌ Should fail if file type is invalid (e.g., a .txt file)', async () => {
        const res = await request(app)
            .post('/products')
            .set('Authorization', `Bearer ${merchantToken}`)
            .field('name', 'Broken Product')
            .field('price', '100')
            .attach('image', 'test/fixtures/fake_image.txt');

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toContain('Only JPEG, PNG, and WebP');
    });
});

    describe('GET /products', () => {
        test('✅ Can filter products by category', async () => {
            const res = await request(app).get('/products?category=Electronics');
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        test('✅ Can convert price to GHS', async () => {
            const res = await request(app).get(`/products/${productOneId}?currency=GHS`);
            expect(res.statusCode).toBe(200);
            expect(res.body.data.currency).toBe("GHS");
            // If cache was used in your service, check for:
            // expect(res.body.data).toHaveProperty('isStale');
        });
    });

    describe('PUT & DELETE /api/products/:id', () => {
        test('❌ Merchant Two cannot update Merchant One product', async () => {
            const res = await request(app)
                .put(`/products/${productOneId}`)
                .set('Authorization', `Bearer ${merchantTwoToken}`)
                .send({ name: "Hacked" });

            expect(res.statusCode).toBe(403);
        });

        test('✅ Merchant can soft-delete their own product', async () => {
            const res = await request(app)
                .delete(`/products/${productOneId}`)
                .set('Authorization', `Bearer ${merchantOneToken}`);

            expect(res.statusCode).toBe(200);

            // Verify it is no longer visible in GET
            const check = await request(app)
                .get(`/products/${productOneId}`);
            expect(check.statusCode).toBe(404);
        });
    });
});