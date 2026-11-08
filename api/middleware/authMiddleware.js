const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { logSecurity } = require('../utils/logger');

// @desc    Verifies the JWT and attaches the authenticated user to req.user
const protect = async (req, res, next) => {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        logSecurity(req, 'auth.token.missing', {}, 'info');
        return res.status(401).json({ message: 'Not authorized, no token.' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        // Token revocation: a token that was logged out is refused even though its
        // signature is still valid and it has not yet expired.
        if (decoded.jti) {
            const revoked = await RevokedToken.exists({ jti: decoded.jti });
            if (revoked) {
                logSecurity(req, 'auth.token.rejected', { reason: 'revoked', tokenUserId: decoded.id, jti: decoded.jti });
                return res.status(401).json({ message: 'Not authorized, session has ended.' });
            }
        }

        // Confirm the user still exists and use the role stored in the database, not the token
        const user = await User.findById(decoded.id);
        if (!user) {
            logSecurity(req, 'auth.token.rejected', { reason: 'user_not_found', tokenUserId: decoded.id });
            return res.status(401).json({ message: 'Not authorized, user no longer exists.' });
        }

        req.user = { id: user._id.toString(), username: user.username, role: user.role };
        // Raw claims, used by the logout handler to revoke exactly this token
        req.auth = { id: user._id.toString(), jti: decoded.jti, exp: decoded.exp };
        return next();
    } catch (error) {
        // e.g. TokenExpiredError, JsonWebTokenError (bad signature / tampered token)
        logSecurity(req, 'auth.token.rejected', { reason: error.name });
        return res.status(401).json({ message: 'Not authorized, token failed.' });
    }
};

// @desc    Role-based access control: only allows the listed roles through
const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        logSecurity(req, 'access.denied.role', { requiredRoles: roles });
        return res.status(403).json({ message: 'Forbidden: you do not have permission to perform this action.' });
    }
    return next();
};

module.exports = { protect, authorize };
