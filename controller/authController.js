const db = require('../config/db');
const bcrypt = require('bcrypt');
const {generateToken} = require('../middleware/jwt');
const logger = require('../utils/logger');
const { validateRegistration } = require('../utils/validation');

exports.registerUser = async (req, res) => {

    const { error } = validateRegistration(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { first_name, last_name, email, password, role, country, base_currency } = req.body;

    try {
        const full_name = `${first_name.trim().toUpperCase()} ${last_name.trim().toUpperCase()}`;
        const hashedPassword = await bcrypt.hash(password);

        const query = `
            WITH attempt AS (
                INSERT INTO users (full_name, email, password_hash, role, country, base_currency)
                VALUES ($1, LOWER($2), $3, $4, $5, $6)
                ON CONFLICT (email) DO NOTHING
                RETURNING id, full_name, email, role, country, base_currency, FALSE as email_exists
            )
            SELECT * FROM attempt
            UNION ALL
            SELECT id, full_name, email, role, country, base_currency, TRUE as email_exists 
            FROM users 
            WHERE email = LOWER($2)
            LIMIT 1;
        `;

        const { rows } = await db.query(query, [
            userId,
            full_name.trim(),
            email.toLowerCase().trim(),
            hashedPassword,
            role,
            country,
            base_currency
        ]);

        const user = rows[0];

        if (user.email_exists) {
            logger.warn('Registration conflict: Email already exists', { email });

            return res.status(409).json({
                error: "Conflict",
                message: "This email is already registered."
            });
        }

        const token = generateToken(generatePayload(user));

        res.status(201).json({
            success: true,
            message: "Registration successful",
            user: generatePayload(user),
            token: token
        });

    } catch (err) {
        console.error(`[Registration Error]: ${err.message}`);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
};

function generatePayload(user){
    return {
        id: user.id,
        email: user.email,
        role: user.role
    }
}