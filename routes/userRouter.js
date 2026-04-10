const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/jwt');
const authorizeRoles = require('../middleware/roleCheck');
const userController = require('../controllers/userController');


router.get('/:id', authenticateToken, authorizeRoles('customer', 'merchant'), userController.getUser);
router.put('/update/:id', authenticateToken, authorizeRoles('customer', 'merchant'), userController.updateUser);
router.delete('/delete/:id', authenticateToken, authorizeRoles('customer', 'merchant'), userController.deleteUser);

module.exports = router;