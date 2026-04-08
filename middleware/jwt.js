const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // 1. Get token from a header
    const authHeader = req.headers['authorization'];

    // Check if a header exists and starts with 'Bearer'
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            status: 401,
            error: 'Unauthorized',
            message: 'Access denied. No token provided.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verify Token
        const decoded= jwt.verify(token, process.env.JWT_SECRET);

        // 3. Attach user data to request an object
        // This allows your rate limiter to see req.user.id
        req.user = decoded;

        // 4. Move to the next middleware (like your userLimiter)
        next();
    } catch (err) {
        // 5. Handle specific JWT errors
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 401,
                error: 'Unauthorized',
                message: 'Token has expired. Please log in again.'
            });
        }

        return res.status(403).json({
            status: 403,
            error: 'Forbidden',
            message: 'Invalid token.'
        });
    }
};

const generateToken = (payload) => {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn: '1d',
            issuer: 'Pan-Afrik Store'
        });
}

module.exports = {
    authenticateToken,
    generateToken
};