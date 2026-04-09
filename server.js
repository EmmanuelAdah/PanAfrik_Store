require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { corsConfig } = require('./config/corsConfig');
const db = require('./config/db'); // Import your DB config

const app = express();

// Middleware
app.use(express.json());
app.use(corsConfig());
app.use(helmet());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

const startServer = async () => {
  try {
    await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server started on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server: Could not connect to Database.');
    process.exit(1); // Exit with failure
  }
};

startServer();