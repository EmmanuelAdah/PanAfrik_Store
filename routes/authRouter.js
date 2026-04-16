const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const catchAsyncErrors = require('../utils/catchAsyncErrors');

router.post(
    '/register',
    catchAsyncErrors(authController.registerUser)
);
router.post(
    '/login',
    catchAsyncErrors(authController.loginUser)
);

module.exports = router;