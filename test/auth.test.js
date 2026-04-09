const request = require('supertest');
const app = require('../app');
const db = require('../config/db'); // Consistently use 'db'
const bcrypt = require('bcrypt');

describe('Auth System Integration Tests', () => {
    const newUser = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'newuser@example.com',
        password: 'Password123!',
        role: 'customer',
        country: 'NG',
        base_currency: 'NGN'
    };

    const loginUser = {
        email: 'tester@example.com',
        password: 'Password123!'
    };

    // Global Setup: Create the login user once
    beforeAll(async () => {
        const hash = await bcrypt.hash(loginUser.password, 10);
        await db.query("DELETE FROM users WHERE email IN ($1, $2)", [
            newUser.email.toLowerCase(),
            loginUser.email.toLowerCase()
        ]);

        await db.query(
            "INSERT INTO users (full_name, email, password_hash, role, country, base_currency) VALUES ($1, $2, $3, $4, $5, $6)",
            ['Test User', loginUser.email.toLowerCase(), hash, 'customer', 'NG', 'NGN']
        );
    });

    // Global Cleanup: Close the pool after all tests in this file are done
    afterAll(async () => {
        await db.query("DELETE FROM users WHERE email IN ($1, $2)", [
            newUser.email.toLowerCase(),
            loginUser.email.toLowerCase()
        ]);
        await db.end();
    });

    // --- REGISTRATION TESTS ---
    describe('POST /api/auth/register', () => {
        test('✅ Should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(newUser);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.user.email).toBe(newUser.email.toLowerCase());
        });

        test('❌ Should return 409 if email is already registered', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(newUser); // Registering the same user again

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toBe('Conflict');
        });
    });

    // --- LOGIN TESTS ---
    describe('POST /api/auth/login', () => {
        test('✅ Should login successfully with correct credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginUser.email, password: loginUser.password });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.message).toBe('Login successful');
        });

        test('❌ Should fail with incorrect password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginUser.email, password: 'wrongpassword' });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        test('❌ Should fail if email does not exist', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@random.com', password: loginUser.password });

            expect(res.statusCode).toBe(401);
        });

        test('❌ Should fail if fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: loginUser.email });

            expect(res.statusCode).toBe(400);
        });
    });
});