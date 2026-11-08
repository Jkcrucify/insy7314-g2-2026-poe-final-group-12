const ROLES = Object.freeze({
    CLIENT: 'Client',
    FREELANCER: 'Freelancer'
});

const GIG_CATEGORIES = Object.freeze([
    'Design',
    'Development',
    'Writing',
    'Marketing',
    'Video & Animation',
    'Music & Audio',
    'Tutoring',
    'Other'
]);

// Account lockout: rate limiting protects an IP address, this protects a single
// account from a slow brute-force spread across many IP addresses.
const LOCKOUT = Object.freeze({
    MAX_FAILED_ATTEMPTS: Number(process.env.LOCKOUT_MAX_ATTEMPTS) || 5,
    LOCK_MINUTES: Number(process.env.LOCKOUT_MINUTES) || 15
});

module.exports = { ROLES, GIG_CATEGORIES, LOCKOUT };
