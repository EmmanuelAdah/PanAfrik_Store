// Catch synchronous "bugs" immediately
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥', err.name, err.message);
  process.exit(1);
});

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { corsConfig } = require('./config/corsConfig');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const app = express();

app.use(express.json());
app.use(corsConfig());
app.use(helmet());

app.use('/auth', require('./routes/authRouter'));
app.use('/users', require('./routes/userRouter'));
app.use('/products', require('./routes/productRouter'));
app.use('/rates', require('./routes/rateRouter'));
app.use('/cart', require('./routes/cartRouter'));
app.use('/', require('./routes/orderRouter'));

app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
});

// Catch asynchronous "unhandled promises"
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥', err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});