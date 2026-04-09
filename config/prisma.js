// config/prisma.js
require('dotenv').config(); // Load variables from .env
const { PrismaClient } = require('../prisma/generated/client');

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in the environment variables.");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

module.exports = prisma;