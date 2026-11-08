const { FilterXSS } = require('xss');
const { logSecurity } = require('../utils/logger');

// Strip all HTML tags (and the contents of script/style tags) from user input
const xssFilter = new FilterXSS({
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
});

// Passwords are hashed and never rendered, so they are left untouched
const SKIP_KEYS = new Set(['password']);

// Keys that can reach Object.prototype when assigned with bracket notation.
// A request body of { "__proto__": { "isAdmin": true } } would otherwise add
// `isAdmin` to every object in the process (prototype pollution), which can
// silently change the behaviour of code that reads a property it never set.
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// `report` (optional) collects the field paths that were changed, for security logging
const clean = (value, report, path = '') => {
    if (typeof value === 'string') {
        const cleaned = xssFilter.process(value);
        if (report && cleaned !== value) report.xss.push(path);
        return cleaned;
    }
    if (Array.isArray(value)) {
        return value.map((item, i) => clean(item, report, `${path}[${i}]`));
    }
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            const fieldPath = path ? `${path}.${key}` : key;

            // Drop MongoDB operator keys such as $ne / $gt and dotted paths (NoSQL injection)
            if (key.startsWith('$') || key.includes('.')) {
                if (report) report.operators.push(fieldPath);
                continue;
            }
            // Drop keys that would walk up the prototype chain
            if (PROTOTYPE_KEYS.has(key)) {
                if (report) report.prototypeKeys.push(fieldPath);
                continue;
            }

            // Safe: `key` has been checked against the deny list above, and the
            // target is a fresh object literal that nothing else holds a reference to.
            // eslint-disable-next-line security/detect-object-injection
            result[key] = SKIP_KEYS.has(key) ? val : clean(val, report, fieldPath);
        }
        return result;
    }
    return value;
};

// @desc    Sanitises the request body against XSS, NoSQL injection and prototype pollution
const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const report = { xss: [], operators: [], prototypeKeys: [] };
        req.body = clean(req.body, report);

        // Only field names are logged, never the malicious values themselves
        if (report.operators.length) {
            logSecurity(req, 'input.nosql_operator_removed', { fields: report.operators });
        }
        if (report.prototypeKeys.length) {
            logSecurity(req, 'input.prototype_key_removed', { fields: report.prototypeKeys });
        }
        if (report.xss.length) {
            logSecurity(req, 'input.html_stripped', { fields: report.xss });
        }
    }
    next();
};

module.exports = { sanitizeInput, clean };
