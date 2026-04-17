const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/jwt');
const catchAsyncErrors = require('../utils/catchAsyncErrors');
const cartController = require("../controllers/cartController");


router.post('/', authenticateToken, catchAsyncErrors(cartController.addToCart));
router.get('/', authenticateToken, catchAsyncErrors(cartController.getCart));
router.delete('/:itemId', authenticateToken, catchAsyncErrors(cartController.removeFromCart));

module.exports = router;