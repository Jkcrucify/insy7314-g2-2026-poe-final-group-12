const express = require('express');
const router = express.Router();
const { getMyTransactions, getIncomeSummary } = require('../controllers/transactionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { incomeQueryRules } = require('../validators/transactionValidators');
const { ROLES } = require('../utils/constants');

// Every transaction route requires a valid JWT
router.use(protect);

router.get('/mine', getMyTransactions);
router.get('/income', authorize(ROLES.FREELANCER), incomeQueryRules, validate, getIncomeSummary);

module.exports = router;
