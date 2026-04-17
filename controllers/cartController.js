const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');
const { validateCart } = require('../utils/validator');

exports.addToCart = async (req, res) => {
    const isValid = validateCart(req.body);
    if (!isValid) {
        return res.status(400).json({ message: 'Invalid cart item data.' });
    }

    const { productId, quantity } = req.body;
    const userId = req.user.id;

    try {
        // 1. Validate product exists and is active
        const product = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!product || !product.isActive) {
            return res.status(404).json({ message: 'Product not found or currently inactive.' });
        }

        // 2. Upsert cart item
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
    const userCurrency = req.user.baseCurrency || 'USD';

    try {
        const items = await prisma.cartItem.findMany({
            where: { userId },
            include: { product: true }
        });

        const cachedRates = await redisClient.get('rates:global:latest');
        const ratesInfo = cachedRates ? JSON.parse(cachedRates) : null;
        const rates = ratesInfo?.rates;

        let totalInBase = 0;
        const formattedItems = items.map(item => {
            const priceUSD = item.product.price;

            // Logic: Your sync tool saves { "NGN": { "USD": 0.00074 } }
            // To get NGN from USD, we divide by the NGN-to-USD rate
            const rateToUSD = rates?.[userCurrency]?.['USD'] || 1;
            const convertedPrice = priceUSD / rateToUSD;

            const subtotal = convertedPrice * item.quantity;
            totalInBase += subtotal;

            return {
                id: item.id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPriceInBase: Number(convertedPrice.toFixed(2)),
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
        // Ensure user owns the item before deleting
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