const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');


exports.checkOut = async (req, res) => {
    const userId = req.user.id;
    const { customerCurrency } = req.body;

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Fetch Cart with Product details
            const cartItems = await tx.cartItem.findMany({
                where: { userId },
                include: { product: true }
            });

            if (cartItems.length === 0) throw new Error("Cart is empty");

            // Fetch & Lock Exchange Rate (Redis -> DB Fallback)
            const cachedData = await redisClient.get('rates:global:latest');
            let rateData = cachedData ? JSON.parse(cachedData).rates : null;

            if (!rateData) {
                const lastDbRate = await tx.rateCache.findFirst({ orderBy: { fetchedAt: 'desc' } });
                rateData = lastDbRate?.rates;
            }

            if (!rateData) throw new Error("EXCHANGE_RATE_UNAVAILABLE");

            const exchangeRate = rateData[customerCurrency]?.['USD'] || 1;

            // Initialize Order
            const order = await tx.order.create({
                data: {
                    customerId: userId,
                    customerCurrency: customerCurrency,
                    exchangeRateApplied: exchangeRate,
                    customerTotal: 0
                }
            });

            let runningCustomerTotal = 0;

            // Create Order Items & Calculate Payouts
            for (const item of cartItems) {
                const product = item.product;

                // Merchant calculations (original currency)
                const unitPriceMerchant = product.price;
                const payoutAmount = Number(unitPriceMerchant) * item.quantity;

                // Customer calculations (converted currency)
                // If product is USD and customer is NGN, and rate NGN->USD is 0.00074:
                // PriceInNGN = PriceInUSD / 0.00074
                const unitPriceCustomer = Number(unitPriceMerchant) / Number(exchangeRate);
                const lineTotalCustomer = Number((unitPriceCustomer * item.quantity).toFixed(5));

                runningCustomerTotal += lineTotalCustomer;

                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: product.id,
                        merchantId: product.merchantId,
                        quantity: item.quantity,
                        unitPriceMerchantCurrency: unitPriceMerchant,
                        merchantCurrency: product.currency,
                        merchantPayoutAmount: payoutAmount
                    }
                });
            }

            // Finalize Order & Clear Cart
            const finalizedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    customerTotal: runningCustomerTotal,
                    status: 'completed'
                }
            });

            await tx.cartItem.deleteMany({ where: { userId } });

            return finalizedOrder;
        });

        res.status(201).json({ success: true, order: result });

    } catch (error) {
        logger.error('Checkout Error:', error.message);
        const status = error.message === "CART_EMPTY" ? 400 : 500;
        res.status(status).json({ message: error.message });
    }
};

// GET /orders/:id
exports.getOrderDetails = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const order = await prisma.order.findUnique({
            where: { id },
            include: { orderItems: { include: { product: true } } }
        });

        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Access Control: Customer who placed it OR Merchant who has an item in it
        const isCustomer = order.customerId === userId;
        const isMerchant = order.orderItems.some(item => item.merchantId === userId);

        if (!isCustomer && !isMerchant) {
            return res.status(403).json({ message: 'Access denied to this order.' });
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /orders (Merchant/Customer Scope)
exports.getOrders = async (req, res) => {
    const userId = req.user.id;

    try {
        const orders = await prisma.order.findMany({
            where: {
                orderItems: { some: { userId } }
            },
            include: {
                orderItems: {
                    where: { userId },
                    include: { product: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};