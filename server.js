require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { corsConfig } = require('./config/corsConfig');

const app = express();

// Middleware
app.use(express.json());
app.use(corsConfig());
app.use(helmet());

// Routes
app.use('/auth', require('./routes/authRouter'));
app.use('/users', require('./routes/userRouter'));
app.use('/products', require('./routes/productRouter'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
});
