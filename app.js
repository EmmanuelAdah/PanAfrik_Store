const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRouter');
const userRoutes = require('./routes/userRouter');
const productRoutes = require('./routes/productRouter');
const rateRoutes = require('./routes/rateRouter');
const cartRoutes = require('./routes/cartRouter');
const orderRoutes = require('./routes/orderRouter');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/rates', rateRoutes);
app.use('/cart', cartRoutes);
app.use('/', orderRoutes);

// Export the app instance
module.exports = app;