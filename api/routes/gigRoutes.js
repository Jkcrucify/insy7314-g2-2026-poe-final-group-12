const express = require('express');
const router = express.Router();
const {
    listGigs, getMyGigs, getGigById, createGig, updateGig, deleteGig
} = require('../controllers/gigController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validateMiddleware');
const { idParam, createGigRules, updateGigRules, listGigRules } = require('../validators/gigValidators');
const { ROLES } = require('../utils/constants');

// Every gig route requires a valid JWT
router.use(protect);

router.get('/', listGigRules, validate, listGigs);
router.get('/mine', authorize(ROLES.FREELANCER), getMyGigs);
router.get('/:id', idParam, validate, getGigById);
router.post('/', authorize(ROLES.FREELANCER), createGigRules, validate, createGig);
router.put('/:id', authorize(ROLES.FREELANCER), updateGigRules, validate, updateGig);
router.delete('/:id', authorize(ROLES.FREELANCER), idParam, validate, deleteGig);

module.exports = router;
