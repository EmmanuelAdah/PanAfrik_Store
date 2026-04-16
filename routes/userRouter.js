const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/jwt');
const authorizeRoles = require('../middleware/roleCheck');
const userController = require('../controllers/userController');
const catchAsyncErrors = require('../utils/catchAsyncErrors');


router.get(
    '/:id',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    catchAsyncErrors(userController.getUser)
);
router.put(
    '/update/:id',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    catchAsyncErrors(userController.updateUser)
);
router.delete(
    '/delete/:id',
    authenticateToken,
    authorizeRoles('customer', 'merchant'),
    catchAsyncErrors(userController.deleteUser)
);

module.exports = router;