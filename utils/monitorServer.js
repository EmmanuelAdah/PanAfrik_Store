const logger = require('./logger');
const axios = require('axios');
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL


const monitorServer = async () => {
    try {
        const health = await axios.get(`${HEALTH_CHECK_URL}`)
        logger.info(health.data)
    } catch (error) {
        logger.error('Server is down: ', error.message)
    }
}

setInterval(() =>{
    monitorServer()
}, 1000 * 60 * 14)