const logger = require('../utils/logger');

const rates = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`);

logger.info(rates);