const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const userLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    statusCode: 429,
    message: {
        status: 429,
        error: 'Too Many Requests',
        message: 'You have exceeded the 5 requests per minute limit.'
    },
    keyGenerator: (req, res) => {
        return req.user ? req.user.id : ipKeyGenerator(req.ip); // ✅ wrap the IP fallback
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = userLimiter;