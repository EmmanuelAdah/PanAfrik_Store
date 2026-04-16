const prisma = require('../config/prisma'); // Your new Prisma instance
const { hashPassword, comparePassword } = require('../middleware/hash');
const { generateToken } = require('../middleware/jwt');
const logger = require('../utils/logger');
const { validateRegistration } = require('../utils/validator');
const generatePayload = require('../utils/generatePayload');

exports.registerUser = async (req, res) => {
    const { error } = validateRegistration(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { first_name, last_name, email, password, role, country, base_currency } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    try {
        const full_name = `${first_name.trim().toUpperCase()} ${last_name.trim().toUpperCase()}`;
        const hashedPassword = await hashPassword(password);

        const existingUser = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (existingUser) {
            logger.warn('Registration conflict: Email already exists', { email: cleanEmail });
            return res.status(409).json({
                error: "Conflict",
                message: "This email is already registered."
            });
        }

        const newUser = await prisma.user.create({
            data: {
                fullName: full_name,
                email: cleanEmail,
                passwordHash: hashedPassword,
                role: role,
                country: country,
                baseCurrency: base_currency
            }
        });

        const token = generateToken(generatePayload(newUser));

        res.status(201).json({
            success: true,
            message: "Registration successful",
            token: token
        });

    } catch (err) {
        logger.error('Registration error', { error: err.message, context: { cleanEmail, role } });
        res.status(500).json({ error: "Internal server error." });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Use Prisma to find the user
        const user = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        const invalidMessage = "Invalid email or password";

        if (!user || !(await comparePassword(password, user.passwordHash))) {
            return res.status(401).json({ error: invalidMessage });
        }

        const token = generateToken(generatePayload(user));

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: token
        });
    } catch (err) {
        logger.error("Login Controller Error", { error: err.message });
        res.status(500).json({ error: "Internal server error" });
    }
};
