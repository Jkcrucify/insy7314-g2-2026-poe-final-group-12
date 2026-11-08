const express = require('express');
const router = express.Router();
const { registerUser, loginUser, logoutUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validateMiddleware');
const { registerRules, loginRules } = require('../validators/authValidators');

// Define authentication routes
router.post('/register', authLimiter, registerRules, validate, registerUser);
router.post('/login', authLimiter, loginRules, validate, loginUser);
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);

module.exports = router;
