const mongoose = require('mongoose');
const { ROLES, LOCKOUT } = require('../utils/constants');

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 30
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254
        },
        password: {
            type: String,
            required: true,
            select: false // Never returned by queries unless explicitly requested
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            required: true
        },
        // --- Account lockout (additional security feature) ---------------------
        // Counts consecutive failed logins. Reset to zero on a successful login.
        failedLoginAttempts: {
            type: Number,
            default: 0,
            select: false
        },
        // While this timestamp is in the future the account refuses all logins,
        // even with the correct password.
        lockUntil: {
            type: Date,
            default: null,
            select: false
        }
    },
    { timestamps: true }
);

// True while the account is inside its lockout window
userSchema.virtual('isLocked').get(function isLocked() {
    return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Records a failed attempt and locks the account once the threshold is reached.
// Uses an atomic update so simultaneous attempts cannot race past the limit.
userSchema.methods.registerFailedLogin = async function registerFailedLogin() {
    const attempts = (this.failedLoginAttempts || 0) + 1;
    const shouldLock = attempts >= LOCKOUT.MAX_FAILED_ATTEMPTS;
    const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT.LOCK_MINUTES * 60 * 1000) : this.lockUntil;

    await this.constructor.updateOne(
        { _id: this._id },
        shouldLock
            ? { $set: { failedLoginAttempts: 0, lockUntil } } // Counter restarts after the lock is applied
            : { $inc: { failedLoginAttempts: 1 } }
    );

    return { attempts, locked: shouldLock, lockUntil };
};

// Clears the counter and any expired lock after a successful login
userSchema.methods.clearLoginFailures = async function clearLoginFailures() {
    if (!this.failedLoginAttempts && !this.lockUntil) return;
    await this.constructor.updateOne(
        { _id: this._id },
        { $set: { failedLoginAttempts: 0, lockUntil: null } }
    );
};

// Strip sensitive fields whenever a user document is serialised
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.failedLoginAttempts;
        delete ret.lockUntil;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('User', userSchema);
