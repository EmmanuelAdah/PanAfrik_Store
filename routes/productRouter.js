const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/jwt');
const authorizeRoles = require('../middleware/roleCheck');
const { upload } = require('../config/cloudinaryConfig');
const catchAsyncErrors = require('../utils/catchAsyncErrors');


router.get(
    '/',
    catchAsyncErrors(productController.getAllProducts)
);
router.post(
    '/',
    authenticateToken,
    authorizeRoles('merchant'),
    upload.single('image'),
    catchAsyncErrors(productController.createProduct)
);
router.put(
    '/:id',
    authenticateToken,
    authorizeRoles('merchant'),
    upload.single('image'),
    catchAsyncErrors(productController.updateProduct)
);
router.delete(
    '/:id',
    authenticateToken,
    authorizeRoles('merchant'),
    catchAsyncErrors(productController.deleteProduct)
);

module.exports = router;