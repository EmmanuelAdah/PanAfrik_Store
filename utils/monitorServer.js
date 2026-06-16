const logger = require('./logger');
const axios = require('axios');

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL;

if (!HEALTH_CHECK_URL) {
    throw new Error('HEALTH_CHECK_URL is not configured');
}

const monitorServer = async () => {
    try {
        const response = await axios.get(HEALTH_CHECK_URL, {
            timeout: 5000
        });

        logger.info(
            `Health check passed - Status: ${response.status}`
        );
    } catch (error) {
        logger.error(
            `Health check failed - ${error.message}`
        );
    }
};

monitorServer();

setInterval(monitorServer, 1000 * 60 * 14);