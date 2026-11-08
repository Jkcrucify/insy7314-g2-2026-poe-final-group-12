const rateLimit = require('express-rate-limit');
const { logSecurity } = require('../utils/logger');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Logs every blocked request before sending the 429 response
const loggingHandler = (limiterName) => (req, res, next, options) => {
    logSecurity(req, 'ratelimit.exceeded', { limiter: limiterName, limit: options.limit });
    res.status(options.statusCode).json(options.message);
};

// General limiter for all API routes
const apiLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
    handler: loggingHandler('api')
});

// Strict limiter for login/register to slow down brute-force and credential stuffing.
// Only failed attempts count towards the limit.
const authLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: 'Too many authentication attempts. Please try again in 15 minutes.' },
    handler: loggingHandler('auth')
});

// Per-user limiter for creating bookings (runs after `protect`, so req.user is set)
const bookingLimiter = rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: Number(process.env.BOOKING_RATE_LIMIT_MAX) || 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.user.id,
    message: { message: 'Too many booking requests. Please try again later.' },
    handler: loggingHandler('booking')
});

module.exports = { apiLimiter, authLimiter, bookingLimiter };
