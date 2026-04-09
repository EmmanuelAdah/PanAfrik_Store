const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({
  path: process.env.NODE_ENV === 'test'
    ? path.resolve(__dirname, '../.env.test')
    : path.resolve(__dirname, '../.env')
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// One single export object containing all methods
module.exports = {
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;

      // This log is great for debugging slow queries!
      console.log('Executed query', { text, duration, rows: res.rowCount });

      return res;
    } catch (error) {
      console.error('Database Query Error:', {
        message: error.message,
        query: text
      });
      throw error;
    }
  },

  async getClient() {
    // Standard pool.connect() for transactions
    const client = await pool.connect();
    return client;
  },

  async end() {
    console.log('Closing database pool...');
    return await pool.end();
  }
};