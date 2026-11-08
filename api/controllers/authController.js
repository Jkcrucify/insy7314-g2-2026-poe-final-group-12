const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { LOCKOUT } = require('../utils/constants');
const { logEvent, logSecurity, maskEmail } = require('../utils/logger');

const SALT_ROUNDS = 12;
// Used to keep response timing similar when the email does not exist (mitigates user enumeration)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', SALT_ROUNDS);

const toSafeUser = (user) => ({ id: user._id, username: user.username, email: user.email, role: user.role });

// Every token carries a unique id so a single session can be revoked on logout
const issueToken = (user) => {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
        { id: user._id.toString(), role: user.role, jti },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h', algorithm: 'HS256' }
    );
    return { token, jti };
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (rate limited)
const registerUser = async (req, res) => {
    const { username, email, password, role } = req.body;

    const userExists = await User.exists({ email });
    if (userExists) {
        logSecurity(req, 'auth.register.duplicate', { email: maskEmail(email) });
        return res.status(409).json({ message: 'User already exists.' });
    }

    // Hash password (plain text is never stored)
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await User.create({ username, email, password: hashedPassword, role });

    logEvent(req, 'auth.register.success', { newUserId: newUser._id.toString(), newUserRole: newUser.role });
    return res.status(201).json({
        message: 'User registered successfully.',
        user: toSafeUser(newUser)
    });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public (rate limited, with per-account lockout)
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Password and lockout fields are excluded by default, so request them explicitly
    const user = await User.findOne({ email }).select('+password +failedLoginAttempts +lockUntil');

    // The account is inside its lockout window: refuse before checking the password,
    // so a brute-force attacker gains nothing from guessing during the lock.
    if (user && user.isLocked) {
        const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
        logSecurity(req, 'auth.login.locked_out', {
            email: maskEmail(email),
            targetUserId: user._id.toString(),
            retryAfterSeconds
        });
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(423).json({
            message: `Account temporarily locked after ${LOCKOUT.MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`
        });
    }

    const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !isMatch) {
        let lockApplied = false;
        if (user) {
            const outcome = await user.registerFailedLogin();
            lockApplied = outcome.locked;
            if (outcome.locked) {
                logSecurity(req, 'auth.login.account_locked', {
                    email: maskEmail(email),
                    targetUserId: user._id.toString(),
                    lockMinutes: LOCKOUT.LOCK_MINUTES
                });
            }
        }

        // The reason is logged for investigators but never revealed to the client
        logSecurity(req, 'auth.login.failure', {
            email: maskEmail(email),
            reason: user ? 'wrong_password' : 'unknown_email',
            targetUserId: user?._id.toString(),
            lockApplied
        });
        return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // A good login clears any partial failure count
    await user.clearLoginFailures();

    const { token, jti } = issueToken(user);

    logSecurity(req, 'auth.login.success', { targetUserId: user._id.toString(), targetRole: user.role, jti }, 'info');
    return res.status(200).json({
        message: 'Login successful.',
        token,
        user: toSafeUser(user)
    });
};

// @desc    Revoke the caller's token so it cannot be reused
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    const { jti, exp, id } = req.auth;

    // Upsert keeps a repeated logout idempotent instead of raising a duplicate key error
    await RevokedToken.updateOne(
        { jti },
        { $setOnInsert: { jti, user: id, reason: 'logout', expiresAt: new Date(exp * 1000) } },
        { upsert: true }
    );

    logSecurity(req, 'auth.logout.success', { targetUserId: id, jti }, 'info');
    return res.status(200).json({ message: 'Logged out. This token can no longer be used.' });
};

// @desc    Get the currently authenticated user's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ user: toSafeUser(user) });
};

module.exports = { registerUser, loginUser, logoutUser, getMe };
