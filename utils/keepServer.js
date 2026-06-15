const logger = require('./logger');
const axios = require('axios');
const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL


const keepServer = async () => {
    try {
        const health = await axios.get(`${HEALTH_CHECK_URL}`)
        logger.info(health.data)
    } catch (error) {
        logger.error('Server is down')
    }
}

setTimeout(() =>{
    keepServer()
}, 1000 * 60 * 45)