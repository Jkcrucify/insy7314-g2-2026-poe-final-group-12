const crypto = require('crypto');
const { logger } = require('../utils/logger');

// @desc    Gives every request an ID (returned in X-Request-Id) and logs it once the response is sent
const requestLogger = (req, res, next) => {
    req.id = crypto.randomUUID();
    res.set('X-Request-Id', req.id);
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        // Skip successful health checks so Docker's probe does not flood the logs
        if (req.originalUrl === '/api/status' && res.statusCode === 200) return;

        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        logger.log(level, 'http.request', {
            category: 'http',
            requestId: req.id,
            method: req.method,
            path: req.originalUrl.split('?')[0], // Query strings may hold search terms, so they are not logged
            status: res.statusCode,
            durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
            ip: req.ip,
            userId: req.user?.id
        });
    });

    next();
};

module.exports = { requestLogger };
