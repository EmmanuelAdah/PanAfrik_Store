const logger = require('../utils/logger');

exports.sendWebhook = async (url, payload, isRetry = false) => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(3000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        return true;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            logger.warn('Webhook timed out after 3s', { orderId: payload.orderId });
        }

        if (!isRetry) {
            await delay(5000);
            return sendWebhook(url, payload, true);
        }
        return false;
    }
};