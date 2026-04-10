const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRouter');
const userRoutes = require('./routes/userRouter');
const productRoutes = require('./routes/productRouter');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);

// Export the app instance
module.exports = app;