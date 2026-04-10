const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
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
        const decoded= jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
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
    if (payload.role === 'merchant') {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET,
            {
                expiresIn: '7d',
                issuer: 'Pan-Afrik Store'
            });
    } else {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET,
            {
                expiresIn: '1d',
                issuer: 'Pan-Afrik Store'
            });
    }
}

module.exports = {
    authenticateToken,
    generateToken
};