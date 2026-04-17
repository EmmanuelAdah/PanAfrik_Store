const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/jwt');
const userLimiter = require('../middleware/rateLimiter');
const authorizeRoles = require('../middleware/roleCheck');
const catchAsyncErrors = require('../utils/catchAsyncErrors');
const orderController = require('../controllers/orderController');

router.post(
    '/checkout',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    userLimiter,
    catchAsyncErrors(orderController.checkOut)
);

router.get(
    '/orders',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    catchAsyncErrors(orderController.getOrders)
);

router.get(
    '/orders/:id',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    catchAsyncErrors(orderController.getOrderDetails)
);

module.exports = router;