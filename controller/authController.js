const db = require('../config/db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { validateRegistration } = require('../utils/validation');

const registerUser = async (req, res) => {
    // 1. Validate Input First (Don't waste CPU hashing if data is bad)
    const { error } = validateRegistration(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password, full_name, role, country, base_currency } = req.body;

    try {
        // 2. Check for existing user (Fast SELECT before slow BCRYPT)
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: "Email already in use" });
        }

        // 3. Security: Hash Password
        const saltRounds = 12; // Slightly higher for 2026 standards
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const userId = uuidv4();

        // 4. Database Persistence
        const query = `
            INSERT INTO users (id, email, password_hash, full_name, role, country, base_currency)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, email, full_name, role, base_currency, country
        `;

        const { rows } = await db.query(query, [
            userId,
            email.toLowerCase().trim(), // Sanitize strings
            hashedPassword,
            full_name.trim(),
            role,
            country,
            base_currency
        ]);

        // 5. Response (Avoid sending back the password_hash even by accident)
        res.status(201).json({
            success: true,
            message: "Registration successful",
            user: rows[0]
        });

    } catch (err) {
        // Log the actual error for you, but send a generic one to the user
        console.error(`[Registration Error]: ${err.message}`);
        res.status(500).json({ error: "Internal server error. Please try again later." });
    }
};