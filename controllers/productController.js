const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const { convertCurrency } = require('../services/currencyService');

// GET /products - List active products with filters and conversion
exports.getAllProducts = async (req, res) => {
    try {
        const { currency, search, category, country } = req.query;

        // Build Filters
        const where = { isActive: true };
        if (search) where.name = { contains: search, mode: 'insensitive' };
        if (category) where.category = category;
        if (country) {
            where.merchant = { country: country }; // Filter by merchant's location
        }

        const products = await prisma.product.findMany({
            where,
            include: { merchant: { select: { country: true } } }
        });

        // Apply Currency Conversion if requested
        const processedProducts = await Promise.all(products.map(async (p) => {
            if (currency && currency.toUpperCase() !== p.currency) {
                const conversion = await convertCurrency(p.price, p.currency, currency);
                return {
                    ...p,
                    price: conversion.amount,
                    currency: currency.toUpperCase(),
                    isStale: conversion.isFromCache
                };
            }
            return p;
        }));

        res.status(200).json({ success: true, data: processedProducts });
    } catch (err) {
        logger.error("GetAllProducts Error", { error: err.message });
        res.status(500).json({ error: "Internal server error" });
    }
};

// GET /products/:id - Single product with conversion
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const { currency } = req.query;

        const product = await prisma.product.findUnique({
            where: { id, isActive: true }
        });

        if (!product) return res.status(404).json({ error: "Product not found." });

        if (currency && currency.toUpperCase() !== product.currency) {
            const conversion = await convertCurrency(product.price, product.currency, currency);
            return res.status(200).json({
                success: true,
                data: {
                    ...product,
                    price: conversion.amount,
                    currency: currency.toUpperCase(),
                    isStale: conversion.isFromCache
                }
            });
        }

        res.status(200).json({ success: true, data: product });
    } catch (err) {
        logger.error("GetProductById Error", { error: err.message });
        res.status(500).json({ error: "Internal server error" });
    }
};

// POST /products - Merchant only
exports.createProduct = async (req, res) => {
    try {
        const { name, description, price, category, imageUrl } = req.body;
        const merchantId = req.user.id;

        // Validation
        if (!name || !price) {
            return res.status(400).json({ error: "Name and Price are required." });
        }

        // Fetch merchant to get their base currency
        const merchant = await prisma.user.findUnique({ where: { id: merchantId } });

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price,
                category,
                imageUrl,
                merchantId,
                currency: merchant.baseCurrency // Set from merchant's profile
            }
        });

        res.status(201).json({ success: true, message: "Product created", data: product });
    } catch (err) {
        logger.error("CreateProduct Error", { error: err.message });
        res.status(500).json({ error: "Failed to create product." });
    }
};

// PUT /products/:id - Update own product only
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const merchantId = req.user.id;

        const existingProduct = await prisma.product.findUnique({ where: { id } });
        if (!existingProduct) return res.status(404).json({ error: "Product not found." });

        // Authorization: Check ownership
        if (existingProduct.merchantId !== merchantId) {
            return res.status(403).json({ error: "Access denied. This is not your product." });
        }

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: req.body // In production, validate keys allowed for update
        });

        res.status(200).json({ success: true, data: updatedProduct });
    } catch (err) {
        logger.error("UpdateProduct Error", { error: err.message });
        res.status(500).json({ error: "Update failed." });
    }
};

// DELETE /products/:id - Soft Delete
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const merchantId = req.user.id;

        const product = await prisma.product.findUnique({ where: { id } });
        if (!product) return res.status(404).json({ error: "Product not found." });

        if (product.merchantId !== merchantId) {
            return res.status(403).json({ error: "Access denied." });
        }

        await prisma.product.update({
            where: { id },
            data: { isActive: false }
        });

        res.status(200).json({ success: true, message: "Product deleted successfully." });
    } catch (err) {
        logger.error("DeleteProduct Error", { error: err.message });
        res.status(500).json({ error: "Delete failed." });
    }
};