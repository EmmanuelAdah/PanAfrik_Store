const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');
const { validateCart } = require('../utils/validator');
const { fetchGrossRates } = require('../services/currencyService');

exports.addToCart = async (req, res) => {
    const isValid = validateCart(req.body);
    if (!isValid) {
        return res.status(400).json({ message: 'Invalid cart item data.' });
    }

    const { productId, quantity } = req.body;
    const userId = req.user.id;

    try {
        // Validate product exists and is active
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product || !product.isActive) {
            return res.status(404).json({ message: 'Product not found or currently inactive.' });
        }

        // Insert cart item into the database
        const cartItem = await prisma.cartItem.upsert({
            where: { unique_user_product: { userId, productId } },
            update: { quantity: { increment: quantity } },
            create: { userId, productId, quantity }
        });

        res.status(201).json(cartItem);
    } catch (error) {
        logger.error('POST /cart Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getCart = async (req, res) => {
    const userId = req.user.id;
    // Assume req.user.baseCurrency is attached by your Auth middleware from the User model
    const userCurrency = req.user.baseCurrency;

    try {
        const items = await prisma.cartItem.findMany({
            where: { userId },
            include: { product: true }
        });

        const cachedRates = await redisClient.get('rates-cache:global');
        const ratesInfo = cachedRates ? JSON.parse(cachedRates) : await fetchGrossRates();
        const rates = ratesInfo?.rates;

        let totalInBase = 0;
        const formattedItems = items.map(item => {

            const productPrice = item.product.price;
            const merchantCurrency = item.product.currency;

            // To get the total payment amount for each product depending on the rates and quantity
            let unitPrice;
            if (merchantCurrency !== userCurrency) {
                unitPrice = rates?.[merchantCurrency]?.[userCurrency] * productPrice;
            } else {
                unitPrice = productPrice;
            }

            const subtotal = unitPrice * item.quantity;
            totalInBase += subtotal;

            return {
                id: item.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPriceInBase: Number(unitPrice.toFixed(2)),
                subtotalInBase: Number(subtotal.toFixed(2))
            };
        });

        res.status(200).json({
            items: formattedItems,
            total: Number(totalInBase.toFixed(2)),
            currency: userCurrency,
            rateTimestamp: ratesInfo?.fetched_at || new Date().toISOString(),
            isStale: ratesInfo?.stale || false
        });
    } catch (error) {
        logger.error('GET /cart Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.removeFromCart = async (req, res) => {
    const { itemId } = req.params;
    const userId = req.user.id;

    try {
        // Ensure the user owns the item before deleting
        const deleted = await prisma.cartItem.deleteMany({
            where: { id: itemId, userId }
        });

        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Item not found in your cart.' });
        }

        res.status(204).send();
    } catch (error) {
        logger.error('DELETE /cart/:itemId Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};