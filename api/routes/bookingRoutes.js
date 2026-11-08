const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, getBookingById } = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { bookingLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validateMiddleware');
const { createBookingRules, bookingIdParam } = require('../validators/bookingValidators');
const { ROLES } = require('../utils/constants');

// Every booking route requires a valid JWT
router.use(protect);

router.post('/', authorize(ROLES.CLIENT), bookingLimiter, createBookingRules, validate, createBooking);
router.get('/mine', getMyBookings);
router.get('/:id', bookingIdParam, validate, getBookingById);

module.exports = router;
