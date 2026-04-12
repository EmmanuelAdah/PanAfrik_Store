const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/jwt');
const authorizeRoles = require('../middleware/roleCheck');
const { upload } = require('../config/cloudinaryConfig');


router.get('/', productController.getAllProducts);
router.post('/', authenticateToken, authorizeRoles('merchant'), upload.single('image'), productController.createProduct);
router.put('/:id', authenticateToken, authorizeRoles('merchant'), upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticateToken, authorizeRoles('merchant'), productController.deleteProduct);

module.exports = router;