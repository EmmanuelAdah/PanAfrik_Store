const rateLimit = require('express-rate-limit');

const userLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each user to 5 requests per minute

    // Explicitly set the 429 status codes
    statusCode: 429,

    // Customizing the response body
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