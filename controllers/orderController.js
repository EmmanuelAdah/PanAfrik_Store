const logger = require('../utils/logger');
const { getCrossRates } = require('../services/currencyService');

const rates = await getCrossRates();

logger.info(rates);