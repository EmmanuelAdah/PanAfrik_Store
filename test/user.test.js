require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');
const { generateToken } = require('../middleware/jwt');

describe('User Operations (Merchant & Customer)', () => {
    let merchantToken, customerToken;
    let merchantUser, customerUser;

    beforeAll(async () => {

        await prisma.user.deleteMany({
            where: { email: { in: ['merchant@test.com', 'customer@test.com'] } }
        });

        const hashedPassword = await bcrypt.hash("hash123", 12);

        // Seed Merchant
        merchantUser = await prisma.user.create({
            data: {
                fullName: "MAIN MERCHANT",
                email: "merchant@test.com",
                passwordHash: hashedPassword,
                role: "merchant",
                country: "NG",
                baseCurrency: "NGN"
            }
        });

        // Seed Customer
        customerUser = await prisma.user.create({
            data: {
                fullName: "REGULAR CUSTOMER",
                email: "customer@test.com",
                passwordHash: hashedPassword,
                role: "customer",
                country: "NG",
                baseCurrency: "NGN"
            }
        });

        merchantToken = generateToken({ id: merchantUser.id, role: merchantUser.role });
        customerToken = generateToken({ id: customerUser.id, role: customerUser.role });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe('Profile Privacy Checks', () => {
        test('✅ Customer should be able to view their own profile', async () => {
            const res = await request(app)
                .get(`/users/${customerUser.id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user.email).toBe(customerUser.email);
        });

        test('✅ Merchant view profile_return 200 Ok', async () => {
            const res = await request(app)
                .get(`/users/${merchantUser.id}`)
                .set('Authorization', `Bearer ${merchantToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.user.email).toBe(merchantUser.email);
        });

        test('❌ Merchant should NOT be able to view Customer profile', async () => {
            const res = await request(app)
                .get(`/users/${customerUser.id}`)
                .set('Authorization', `Bearer ${merchantToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toContain("Access denied");
        });

        test('❌ Customer view merchant profile_returns 403 Unauthorized', async () => {
            const res = await request(app)
                .get(`/users/${merchantUser.id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.error).toContain("Access denied");
        });
    });

    describe('Update Logic', () => {
        test('✅ Merchant can update their own profile', async () => {
            const res = await request(app)
                .put(`/users/update/${merchantUser.id}`)
                .set('Authorization', `Bearer ${merchantToken}`)
                .send({ first_name: "Global", last_name: "Seller" });

            expect(res.statusCode).toBe(200);
            expect(res.body.user.id).toBe(merchantUser.id);
            expect(res.body.user.role).toBe('merchant');
        });

        test('❌ Customer cannot update Merchant profile', async () => {
            const res = await request(app)
                .put(`/users/update/${merchantUser.id}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ first_name: "Hack" });

            expect(res.statusCode).toBe(403);
        });
    });

    describe('Deletion Logic', () => {
        test('❌ Merchant cannot delete Customer account', async () => {
            const res = await request(app)
                .delete(`/users/delete/${customerUser.id}`)
                .set('Authorization', `Bearer ${merchantToken}`);

            expect(res.statusCode).toBe(403);
        });

        test('✅ Customer can delete their own account', async () => {
            const res = await request(app)
                .delete(`/users/delete/${customerUser.id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.statusCode).toBe(200);

            // Confirm removal
            const check = await prisma.user.findUnique({ where: { id: customerUser.id } });
            expect(check).toBeNull();
        });
    });
});