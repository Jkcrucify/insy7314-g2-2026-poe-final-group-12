const { query } = require('express-validator');
const { AGE_GROUPS } = require('../utils/tax');

// The income endpoint accepts two optional planning inputs. Both are validated
// strictly: anything that is not a plain number or a known age group is rejected
// with a 400 rather than being coerced, so no untrusted value reaches the
// aggregation pipeline or the tax calculation.
const incomeQueryRules = [
    query('expenses')
        .optional()
        .isFloat({ min: 0, max: 100000000 })
        .withMessage('Expenses must be a number between 0 and 100 000 000.'),
    query('ageGroup')
        .optional()
        .isIn(Object.values(AGE_GROUPS))
        .withMessage(`Age group must be one of: ${Object.values(AGE_GROUPS).join(', ')}.`)
];

module.exports = { incomeQueryRules };
