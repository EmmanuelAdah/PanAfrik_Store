// middleware/roleCheck.js

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: 403,
                error: 'Forbidden',
                message: 'You do not have permission to perform this action.'
            });
        }
        next();
    };
};

module.exports = authorizeRoles;