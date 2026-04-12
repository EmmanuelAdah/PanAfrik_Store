// 1. MUST BE FIRST: Load environment variables
require('dotenv').config();

const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');

describe('Auth System Integration Tests', () => {
    // Shared test data
    const testUser = {
        first_name: 'Emmanuel',
        last_name: 'Adah',
        email: 'test_user@pana-frik.com',
        password: 'SecurePassword123!',
        role: 'customer',
        country: 'NG',
        base_currency: 'NGN'
    };

    const invalidUser = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'test_user@pana-frik.com',
        password: 'SecurePassword123!',
        role: 'admin',
        country: 'NG',
        base_currency: 'NGN'
    };

    const cleanEmail = testUser.email.toLowerCase().trim();
    const invalidUserEmail = invalidUser.email.toLowerCase().trim();


    beforeAll(async () => {
        try {
            // Check connection by attempting to delete (even if 0 rows)
            await prisma.user.deleteMany({
                where: { email: cleanEmail }
            });

            await prisma.user.deleteMany({
                where: { email: invalidUserEmail }
            });
        } catch (error) {
            console.error('❌ Database Connection Error during beforeAll:', error.message);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await prisma.user.deleteMany({
                where: { email: cleanEmail }
            });
        } finally {
            await prisma.$disconnect();
            console.log("✅ Prisma disconnected successfully.");
        }
    });

    // --- REGISTRATION SUITE ---
    describe('POST /auth/register', () => {

        test('✅ Should successfully register a new user', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send(testUser);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Registration successful');
            expect(res.body).toHaveProperty('token');

            // Verify payload mapping (camelCase baseCurrency -> currency)
            expect(res.body.user).toMatchObject({
                email: cleanEmail,
                country: testUser.country,
                currency: testUser.base_currency,
                role: testUser.role
            });
        });

        test('✅ Register new user with role-admin_return 400 Bad request', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send(invalidUser);

            expect(res.statusCode).toBe(400);
        });

        test('❌ Should return 409 for duplicate email registration', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send(testUser);

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toBe('Conflict');
        });

        test('❌ Should return 400 if validation fails (missing first_name)', async () => {
            const { first_name, ...invalidUser } = testUser;
            const res = await request(app)
                .post('/auth/register')
                .send(invalidUser);

            expect(res.statusCode).toBe(400);
        });
    });

    // --- LOGIN SUITE ---
    describe('POST /auth/login', () => {

        test('✅ Should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user.email).toBe(cleanEmail);
        });

        test('❌ Should fail with incorrect password', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        test('❌ Should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ password: testUser.password });

            expect(res.statusCode).toBe(400);
        });
    });
});