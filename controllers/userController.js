const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const generatePayload = require('../utils/generatePayload');

exports.getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.user.id;

        if (requesterId !== id) {
            return res.status(403).json({ error: "Access denied." });
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                country: true,
                baseCurrency: true,
                createdAt: true
            }
        });

        if (!user) return res.status(404).json({ error: "User not found." });

        res.status(200).json({
            success: true,
            user: generatePayload(user)
        });
    } catch (err) {
        logger.error("GetUser Error", { error: err.message });
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, country, base_currency } = req.body;

        if (req.user.id !== id) {
            return res.status(403).json({ error: "Unauthorized operation." });
        }

        const updateData = {};
        if (first_name && last_name) updateData.fullName = `${first_name.toUpperCase()} ${last_name.toUpperCase()}`;
        if (country) updateData.country = country;
        if (base_currency) updateData.baseCurrency = base_currency;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        res.status(200).json({
            message: "Profile updated",
            user: generatePayload(updatedUser)
        });
    } catch (err) {
        logger.error("UpdateUser Error", { error: err.message });
        res.status(500).json({ error: "Update failed." });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.id !== id) {
            return res.status(403).json({ error: "Unauthorized operation." });
        }

        await prisma.user.delete({ where: { id } });

        res.status(200).json({ message: "User account deleted successfully." });
    } catch (err) {
        logger.error("DeleteUser Error", { error: err.message });
        res.status(500).json({ error: "Delete operation failed." });
    }
};