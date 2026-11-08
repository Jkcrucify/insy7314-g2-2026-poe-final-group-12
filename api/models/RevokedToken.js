const mongoose = require('mongoose');

// -----------------------------------------------------------------------------
// Token revocation list (additional security feature)
// -----------------------------------------------------------------------------
// A signed JWT is normally valid until it expires, so "logging out" in the
// browser does nothing on the server: a token copied from storage keeps working.
// Every token issued by this API carries a unique `jti` claim. Logging out
// records that `jti` here, and the auth middleware refuses any token whose jti
// is listed. That turns logout into real server-side session invalidation.
//
// The documents delete themselves: MongoDB's TTL monitor removes each entry once
// the token would have expired anyway, so the list never grows without bound.
// -----------------------------------------------------------------------------

const revokedTokenSchema = new mongoose.Schema(
    {
        jti: { type: String, required: true, unique: true, index: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        reason: { type: String, enum: ['logout', 'security'], default: 'logout' },
        // TTL index: the document is removed at this time (the token's own expiry)
        expiresAt: { type: Date, required: true, index: { expires: 0 } }
    },
    { timestamps: true }
);

module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
