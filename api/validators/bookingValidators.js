const { body, param } = require('express-validator');

const createBookingRules = [
    body('gigId').isMongoId().withMessage('A valid gig id is required.'),
    body('notes')
        .optional()
        .isString().withMessage('Notes must be text.')
        .trim()
        .isLength({ max: 500 }).withMessage('Notes may not exceed 500 characters.'),
    // Simulated payment: the client must explicitly confirm the payment
    body('confirmPayment')
        .custom(value => value === true).withMessage('Payment must be confirmed to complete the booking.')
];

const bookingIdParam = [param('id').isMongoId().withMessage('Invalid booking id.')];

module.exports = { createBookingRules, bookingIdParam };
