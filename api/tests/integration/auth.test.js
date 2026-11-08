const jwt = require('jsonwebtoken');
const { app, request, auth, createFreelancer, PASSWORD } = require('../setup/helpers');
const User = require('../../models/User');
const RevokedToken = require('../../models/RevokedToken');
const { LOCKOUT } = require('../../utils/constants');

const REGISTRATION = {
    username: 'newuser',
    email: 'newuser@test.com',
    password: PASSWORD,
    role: 'Freelancer'
};

describe('POST /api/auth/register', () => {
    it('registers a user and never returns the password', async () => {
        const response = await request(app).post('/api/auth/register').send(REGISTRATION).expect(201);

        expect(response.body.user).toMatchObject({ username: 'newuser', role: 'Freelancer' });
        expect(response.body.user.password).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    });

    it('stores the password as a bcrypt hash, never in plain text', async () => {
        await request(app).post('/api/auth/register').send(REGISTRATION).expect(201);

        const stored = await User.findOne({ email: REGISTRATION.email }).select('+password');
        expect(stored.password).not.toBe(PASSWORD);
        expect(stored.password).toMatch(/^\$2[aby]\$12\$/); // bcrypt, 12 rounds
    });

    it('rejects a duplicate email with 409', async () => {
        await request(app).post('/api/auth/register').send(REGISTRATION).expect(201);
        await request(app).post('/api/auth/register').send(REGISTRATION).expect(409);
    });

    it('rejects a weak password', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({ ...REGISTRATION, password: 'password' })
            .expect(400);

        expect(response.body.errors.map(e => e.field)).toContain('password');
    });

    it('refuses to create an Admin account', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({ ...REGISTRATION, role: 'Admin' })
            .expect(400);

        expect(await User.exists({ email: REGISTRATION.email })).toBeNull();
    });

    it('rejects an invalid email and an over-long username', async () => {
        await request(app).post('/api/auth/register').send({ ...REGISTRATION, email: 'not-an-email' }).expect(400);
        await request(app).post('/api/auth/register').send({ ...REGISTRATION, username: 'a'.repeat(31) }).expect(400);
    });
});

describe('POST /api/auth/login', () => {
    it('returns a signed HS256 token carrying a unique token id', async () => {
        const { token } = await createFreelancer();
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        expect(decoded.role).toBe('Freelancer');
        expect(decoded.jti).toEqual(expect.any(String));
        expect(decoded.password).toBeUndefined();
    });

    it('gives the same generic message for a wrong password and an unknown email', async () => {
        await createFreelancer();

        const wrongPassword = await request(app)
            .post('/api/auth/login')
            .send({ email: 'sipho@test.com', password: 'Wr0ng!Pass' })
            .expect(401);

        const unknownEmail = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@test.com', password: PASSWORD })
            .expect(401);

        expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });
});

// --- Additional security feature 1: per-account lockout ----------------------
describe('account lockout', () => {
    const failLogin = (email) =>
        request(app).post('/api/auth/login').send({ email, password: 'Wr0ng!Pass' });

    it('counts consecutive failed attempts against the account', async () => {
        await createFreelancer();
        await failLogin('sipho@test.com').expect(401);
        await failLogin('sipho@test.com').expect(401);

        const user = await User.findOne({ email: 'sipho@test.com' }).select('+failedLoginAttempts');
        expect(user.failedLoginAttempts).toBe(2);
    });

    it('locks the account once the threshold is reached', async () => {
        await createFreelancer();

        for (let i = 0; i < LOCKOUT.MAX_FAILED_ATTEMPTS; i += 1) {
            await failLogin('sipho@test.com').expect(401);
        }

        const locked = await failLogin('sipho@test.com').expect(423);
        expect(locked.body.message).toMatch(/locked/i);
        expect(locked.headers['retry-after']).toBeDefined();
    });

    it('refuses the correct password while the account is locked', async () => {
        await createFreelancer();

        for (let i = 0; i < LOCKOUT.MAX_FAILED_ATTEMPTS; i += 1) {
            await failLogin('sipho@test.com').expect(401);
        }

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'sipho@test.com', password: PASSWORD })
            .expect(423);
    });

    it('allows login again once the lock has expired', async () => {
        await createFreelancer();
        await User.updateOne(
            { email: 'sipho@test.com' },
            { $set: { lockUntil: new Date(Date.now() - 1000), failedLoginAttempts: 0 } }
        );

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'sipho@test.com', password: PASSWORD })
            .expect(200);
    });

    it('resets the counter after a successful login', async () => {
        await createFreelancer();
        await failLogin('sipho@test.com').expect(401);
        await failLogin('sipho@test.com').expect(401);

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'sipho@test.com', password: PASSWORD })
            .expect(200);

        const user = await User.findOne({ email: 'sipho@test.com' }).select('+failedLoginAttempts +lockUntil');
        expect(user.failedLoginAttempts).toBe(0);
        expect(user.lockUntil).toBeNull();
    });
});

// --- Additional security feature 2: token revocation on logout ---------------
describe('token revocation', () => {
    it('accepts the token before logout and refuses it afterwards', async () => {
        const { token } = await createFreelancer();

        await request(app).get('/api/auth/me').set(auth(token)).expect(200);
        await request(app).post('/api/auth/logout').set(auth(token)).expect(200);
        const replay = await request(app).get('/api/auth/me').set(auth(token)).expect(401);

        expect(replay.body.message).toMatch(/session has ended/i);
    });

    it('blocks a revoked token on every protected route, not just the profile', async () => {
        const { token } = await createFreelancer();
        await request(app).post('/api/auth/logout').set(auth(token)).expect(200);

        await request(app).get('/api/gigs').set(auth(token)).expect(401);
        await request(app).get('/api/bookings/mine').set(auth(token)).expect(401);
        await request(app).get('/api/transactions/income').set(auth(token)).expect(401);
    });

    it('records the revocation with an expiry so the entry cleans itself up', async () => {
        const { token } = await createFreelancer();
        await request(app).post('/api/auth/logout').set(auth(token)).expect(200);

        const { jti, exp } = jwt.decode(token);
        const revoked = await RevokedToken.findOne({ jti });

        expect(revoked).not.toBeNull();
        expect(revoked.reason).toBe('logout');
        expect(revoked.expiresAt.getTime()).toBe(exp * 1000);
    });

    it('is idempotent when logout is called twice with the same token', async () => {
        const { token } = await createFreelancer();
        await request(app).post('/api/auth/logout').set(auth(token)).expect(200);
        // The second call arrives with a now-revoked token, so it is refused cleanly
        await request(app).post('/api/auth/logout').set(auth(token)).expect(401);

        expect(await RevokedToken.countDocuments()).toBe(1);
    });

    it('leaves other sessions of the same user working', async () => {
        const { token: firstSession } = await createFreelancer();
        const second = await request(app)
            .post('/api/auth/login')
            .send({ email: 'sipho@test.com', password: PASSWORD })
            .expect(200);

        await request(app).post('/api/auth/logout').set(auth(firstSession)).expect(200);

        await request(app).get('/api/auth/me').set(auth(firstSession)).expect(401);
        await request(app).get('/api/auth/me').set(auth(second.body.token)).expect(200);
    });

    it('requires a token to log out', async () => {
        await request(app).post('/api/auth/logout').expect(401);
    });
});
