const logger = require('../utils/logger');
const { PrismaClient } = require('../config/prisma');
const prisma = new PrismaClient();
const { getCrossRates } = require('../services/currencyService');

const rates = await getCrossRates();

// POST /checkout
exports.checkOut = async (req, res) => {

    const { customerCurrency } = req.body;
    const userId = req.user.id;

    try {
        // 1. Start a Prisma Transaction
        const result = await prisma.$transaction(async (tx) => {

            // 2. Fetch Cart Items & Product info
            const cartItems = await tx.cartItem.findMany({
                where: { userId },
                include: { product: true }
            });

            if (cartItems.length === 0) throw new Error("Cart is empty");

            // 3. Get Exchange Rate (Logic from a previous step)
            // Assuming exchangeService returns the rate for the first merchant's currency
            // In a multi-merchant cart, you'd usually pick a base or loop,
            // but here we use the rate for the primary transaction.
            const firstMerchantCurrency = cartItems[0].product.currency;
            const { rate } = await getExchangeRate(firstMerchantCurrency, customerCurrency);

            // 4. Create the Order
            // We initialize with 0 total and update it after calculating items
            const order = await tx.order.create({
                data: {
                    customerId: userId,
                    status: 'pending',
                    customerCurrency: customerCurrency,
                    exchangeRateApplied: rate,
                    customerTotal: 0
                }
            });

            let runningCustomerTotal = 0;

            // 5. Process Line Items
            for (const item of cartItems) {
                const product = item.product;

                // Merchant Payout = Original Price * Quantity (No FX applied here)
                const merchantPayout = Number(product.price) * item.quantity;

                // Customer Line Total = (Original Price * Rate) * Quantity
                const lineTotalCustomer = (Number(product.price) * rate) * item.quantity;
                runningCustomerTotal += lineTotalCustomer;

                // Create OrderItem
                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: product.id,
                        merchantId: product.merchantId,
                        quantity: item.quantity,
                        unitPriceMerchantCurrency: product.price,
                        merchantCurrency: product.currency,
                        merchantPayoutAmount: merchantPayout
                    }
                });

                // Note: Your schema doesn't have a payout_notifications table,
                // but you can add it to Prisma or handle as a separate service call.
            }

            // 6. Update Order with final total and mark completed
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: {
                    customerTotal: runningCustomerTotal,
                    status: 'completed'
                }
            });

            // 7. Clear the Cart
            await tx.cartItem.deleteMany({
                where: { userId }
            });

            return updatedOrder;
        });

        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: result.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
}