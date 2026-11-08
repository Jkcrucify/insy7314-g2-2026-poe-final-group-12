const { logger, logSecurity } = require('../utils/logger');

// @desc    Handles requests to routes that do not exist
const notFound = (req, res) => {
    // Repeated 404s from one IP can indicate scanning for hidden endpoints
    logSecurity(req, 'route.not_found', {}, 'info');
    res.status(404).json({ message: 'Resource not found.' });
};

// @desc    Central error handler: maps known errors to safe messages and never exposes stack traces
const errorHandler = (err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Malformed JSON in request body.' });
    }
    if (err.type === 'entity.too.large') {
        logSecurity(req, 'input.body_too_large', {});
        return res.status(413).json({ message: 'Request body is too large.' });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid identifier supplied.' });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation failed.' });
    }
    if (err.code === 11000) {
        return res.status(409).json({ message: 'A record with these details already exists.' });
    }

    // Full details (including the stack trace) go to the error log only; the client gets a generic message
    logger.error('server.error', {
        category: 'error',
        requestId: req.id,
        method: req.method,
        path: req.originalUrl?.split('?')[0],
        userId: req.user?.id,
        error: err.message,
        errorName: err.name,
        stack: err.stack
    });
    return res.status(500).json({ message: 'An internal server error occurred.' });
};

module.exports = { notFound, errorHandler };
