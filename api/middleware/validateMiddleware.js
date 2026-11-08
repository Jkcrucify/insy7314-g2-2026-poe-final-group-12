const { validationResult } = require('express-validator');
const { logSecurity } = require('../utils/logger');

// @desc    Returns a 400 listing failed fields (input values are never echoed back or logged)
const validate = (req, res, next) => {
    const result = validationResult(req);
    if (!result.isEmpty()) {
        const errors = result.array({ onlyFirstError: true }).map(err => ({
            field: err.path,
            message: err.msg
        }));
        logSecurity(req, 'input.validation_failed', { fields: errors.map(e => e.field) }, 'info');
        return res.status(400).json({ message: 'Validation failed.', errors });
    }
    return next();
};

module.exports = { validate };
