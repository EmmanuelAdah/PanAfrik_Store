const prisma = require('../config/prisma');
const redisClient = require('../config/redisConfig');
const logger = require('../utils/logger');


exports.checkOut = async (req, res) => {
    const userId = req.user.id;
    const { customerCurrency } = req.body; // e.g., 'NGN'

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Fetch Cart with Product details
            const cartItems = await tx.cartItem.findMany({
                where: { userId },
                include: { product: true }
            });

            if (cartItems.length === 0) throw new Error("CART_EMPTY");

            // Rate Locking: Fetch & Lock Exchange Rate
            const cachedData = await redisClient.get('rates-cache:global');
            let rateData = cachedData ? JSON.parse(cachedData).rates : null;

            if (!rateData) {
                const lastDbRate = await tx.rateCache.findFirst({ orderBy: { fetchedAt: 'desc' } });
                rateData = lastDbRate?.rates;
            }

            if (!rateData) throw new Error("EXCHANGE_RATE_UNAVAILABLE");

            // Initialize Order
            // We store the Customer's USD rate as a reference point for the whole order
            const globalExchangeRate = rateData[customerCurrency]?.['USD'] || 1;

            const order = await tx.order.create({
                data: {
                    customerId: userId,
                    customerCurrency: customerCurrency,
                    exchangeRateApplied: globalExchangeRate,
                    customerTotal: 0,
                    status: 'pending'
                }
            });

            let runningCustomerTotal = 0;
            const merchantTotals = {};

            // Create Order Items & Calculate Payouts
            for (const item of cartItems) {
                const product = item.product;
                const merchantCurrency = product.currency;

                // DYNAMIC CALCULATION:
                // If Customer is NGN and Merchant is GHS, we need to rateData['NGN']['GHS']
                const specificRate = customerCurrency === merchantCurrency
                    ? 1
                    : rateData[customerCurrency]?.[merchantCurrency];

                if (!specificRate) throw new Error(`RATE_NOT_FOUND: ${merchantCurrency} to ${customerCurrency}`);

                // Merchant Payout (Original Product Currency)
                const unitPriceMerchant = Number(product.price);
                const linePayoutAmount = unitPriceMerchant * item.quantity;

                // Customer Cost (Converted)
                // If the price is 10 GHS and 1 GHS = 121 NGN, the Customer pays 10 * 121 = 1210 NGN
                const unitPriceCustomer = unitPriceMerchant * specificRate;
                const lineTotalCustomer = Number((unitPriceCustomer * item.quantity).toFixed(2));

                runningCustomerTotal += lineTotalCustomer;

                // Track total per merchant for PayoutNotification
                if (!merchantTotals[product.merchantId]) {
                    merchantTotals[product.merchantId] = { amount: 0, currency: merchantCurrency };
                }
                merchantTotals[product.merchantId].amount += linePayoutAmount;

                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: product.id,
                        merchantId: product.merchantId,
                        quantity: item.quantity,
                        unitPriceMerchantCurrency: unitPriceMerchant,
                        merchantCurrency: merchantCurrency,
                        merchantPayoutAmount: linePayoutAmount
                    }
                });
            }

            // Create Payout Notifications
            for (const [merchantId, data] of Object.entries(merchantTotals)) {
                await tx.payoutNotification.create({
                    data: {
                        orderId: order.id,
                        merchantId: merchantId,
                        amount: data.amount,
                        currency: data.currency,
                        status: 'pending'
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
        logger.error('Checkout Error:', { message: error.message, userId });
        const status = error.message === "CART_EMPTY" ? 400 : 500;
        res.status(status).json({ success: false, message: error.message });
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