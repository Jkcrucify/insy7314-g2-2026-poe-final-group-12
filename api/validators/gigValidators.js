const { body, param, query } = require('express-validator');
const { GIG_CATEGORIES } = require('../utils/constants');

const idParam = [param('id').isMongoId().withMessage('Invalid gig id.')];

// `optional` is true for updates, where every field may be omitted
const gigBodyRules = (optional = false) => {
    const field = (name) => (optional ? body(name).optional() : body(name));
    return [
        field('title')
            .isString().withMessage('Title is required.')
            .trim()
            .isLength({ min: 5, max: 100 }).withMessage('Title must be 5-100 characters.'),
        field('description')
            .isString().withMessage('Description is required.')
            .trim()
            .isLength({ min: 20, max: 1000 }).withMessage('Description must be 20-1000 characters.'),
        field('category')
            .isIn(GIG_CATEGORIES).withMessage('Please choose a valid category.'),
        field('price')
            .isFloat({ min: 50, max: 100000 }).withMessage('Price must be between R50 and R100 000.')
            .toFloat(),
        field('deliveryDays')
            .isInt({ min: 1, max: 60 }).withMessage('Delivery time must be 1-60 days.')
            .toInt()
    ];
};

const createGigRules = gigBodyRules(false);
const updateGigRules = [...idParam, ...gigBodyRules(true)];

const listGigRules = [
    query('search').optional().isString().isLength({ max: 100 }).withMessage('Search term is too long.'),
    query('category').optional().isIn(GIG_CATEGORIES).withMessage('Invalid category.')
];

module.exports = { idParam, createGigRules, updateGigRules, listGigRules };
