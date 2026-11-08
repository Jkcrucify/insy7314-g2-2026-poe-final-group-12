const { body } = require('express-validator');
const { ROLES } = require('../utils/constants');

const registerRules = [
    body('username')
        .isString().withMessage('Username is required.')
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters.')
        .matches(/^[A-Za-z0-9_]+$/).withMessage('Username may only contain letters, numbers and underscores.'),
    body('email')
        .isString().withMessage('Email is required.')
        .trim()
        .isEmail().withMessage('A valid email address is required.')
        .isLength({ max: 254 }).withMessage('Email is too long.')
        .toLowerCase(),
    body('password')
        .isString().withMessage('Password is required.')
        .isLength({ min: 8, max: 64 }).withMessage('Password must be 8-64 characters.')
        .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
        .withMessage('Password must contain an uppercase letter, a lowercase letter, a number and a symbol.'),
    body('role')
        .isIn(Object.values(ROLES)).withMessage(`Role must be one of: ${Object.values(ROLES).join(', ')}.`)
];

const loginRules = [
    body('email')
        .isString().withMessage('Email is required.')
        .trim()
        .isEmail().withMessage('A valid email address is required.')
        .toLowerCase(),
    body('password')
        .isString().withMessage('Password is required.')
        .isLength({ min: 1, max: 64 }).withMessage('Password is required.')
];

module.exports = { registerRules, loginRules };
