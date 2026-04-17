const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rateController');
const catchAsyncErrors = require('../utils/catchAsyncErrors');

router.get('/', catchAsyncErrors(rateController.getLatestRates));

module.exports = router;