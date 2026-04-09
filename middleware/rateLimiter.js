const rateLimit = require('express-rate-limit');

const userLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    statusCode: 429,

    message: {
        status: 429,
        error: 'Too Many Requests',
        message: 'You have exceeded the 5 requests per minute limit.'
    },

    // Use the userId from your auth middleware
    keyGenerator: (req, res) => {
        return req.user ? req.user.id : req.ip;
    },

    standardHeaders: true, // Sends RateLimit-Limit and RateLimit-Remaining headers
    legacyHeaders: false,
});

module.exports = userLimiter;