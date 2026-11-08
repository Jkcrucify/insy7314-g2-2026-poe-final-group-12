const jwt = require('jsonwebtoken');
const { app, request, auth, createFreelancer, PASSWORD } = require('../setup/helpers');
const User = require('../../models/User');

describe('security headers', () => {
    it('sets the Helmet headers on every response', async () => {
        const response = await request(app).get('/api/status').expect(200);

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['content-security-policy']).toContain("default-src 'none'");
        expect(response.headers['referrer-policy']).toBe('no-referrer');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['x-powered-by']).toBeUndefined();
    });
});

describe('NoSQL injection', () => {
    it('refuses an operator object in place of a login email', async () => {
        await createFreelancer();

        // Classic auth bypass: { "email": { "$ne": null } } matches the first user
        const response = await request(app)
            .post('/api/auth/login')
            .send({ email: { $ne: null }, password: { $ne: null } })
            .expect(400);

        expect(response.body.token).toBeUndefined();
    });

    it('strips operator keys out of a nested body', async () => {
        const freelancer = await createFreelancer();

        await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: 'Logo design work',
                description: 'A clean, modern logo delivered as SVG and PNG files.',
                category: 'Design',
                price: 1500,
                deliveryDays: 3,
                $set: { freelancer: '507f1f77bcf86cd799439011' }
            })
            .expect(201);

        // The injected operator must not have changed the owner
        const response = await request(app).get('/api/gigs/mine').set(auth(freelancer.token)).expect(200);
        expect(response.body.gigs).toHaveLength(1);
    });
});

describe('prototype pollution', () => {
    afterEach(() => {
        delete Object.prototype.polluted;
    });

    it('drops __proto__ from a request body instead of copying it through', async () => {
        await request(app)
            .post('/api/auth/login')
            .send({ email: 'someone@test.com', password: 'Str0ng!Pass', __proto__: { polluted: 'yes' } })
            .expect(401);

        expect({}.polluted).toBeUndefined();
        expect(Object.prototype.polluted).toBeUndefined();
    });

    it('drops constructor and prototype keys as well', async () => {
        const freelancer = await createFreelancer();

        const response = await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: 'Logo design work',
                description: 'A clean, modern logo delivered as SVG and PNG files.',
                category: 'Design',
                price: 1500,
                deliveryDays: 3,
                constructor: { prototype: { polluted: 'yes' } },
                prototype: { polluted: 'yes' }
            })
            .expect(201);

        expect(response.body.gig.polluted).toBeUndefined();
        expect({}.polluted).toBeUndefined();
    });

    it('leaves the sanitiser output free of a prototype chain payload', () => {
        const { clean } = require('../../middleware/sanitizeMiddleware');
        const report = { xss: [], operators: [], prototypeKeys: [] };

        const result = clean(JSON.parse('{"a":1,"__proto__":{"polluted":"yes"}}'), report);

        expect(result.a).toBe(1);
        expect(report.prototypeKeys).toContain('__proto__');
        expect({}.polluted).toBeUndefined();
    });
});

describe('cross-site scripting', () => {
    it('strips script tags from stored text', async () => {
        const freelancer = await createFreelancer();

        const response = await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: '<script>alert("xss")</script>Safe title',
                description: 'Normal text <iframe src="evil"></iframe> and more normal text here.',
                category: 'Design',
                price: 1500,
                deliveryDays: 3
            })
            .expect(201);

        expect(response.body.gig.title).not.toMatch(/<script/i);
        expect(response.body.gig.description).not.toMatch(/<iframe/i);
    });
});

describe('JSON web tokens', () => {
    it('refuses a token signed with the wrong secret', async () => {
        const forged = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'Freelancer' }, 'wrong-secret');
        await request(app).get('/api/auth/me').set(auth(forged)).expect(401);
    });

    it('refuses a tampered token', async () => {
        const { token } = await createFreelancer();
        const [header, payload, signature] = token.split('.');
        // Flip the role claim and keep the original signature
        const forgedPayload = Buffer
            .from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), role: 'Admin' }))
            .toString('base64url');

        await request(app).get('/api/auth/me').set(auth(`${header}.${forgedPayload}.${signature}`)).expect(401);
    });

    it('refuses an expired token', async () => {
        const { user } = await createFreelancer();
        const expired = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '-1s' });

        await request(app).get('/api/auth/me').set(auth(expired)).expect(401);
    });

    it('refuses an unsigned "none" algorithm token', async () => {
        const { user } = await createFreelancer();
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ id: user.id, role: 'Freelancer' })).toString('base64url');

        await request(app).get('/api/auth/me').set(auth(`${header}.${payload}.`)).expect(401);
    });

    it('takes the role from the database, not from the token', async () => {
        const { user } = await createFreelancer();
        // A token claiming a role the account does not have must not grant it
        const escalated = jwt.sign({ id: user.id, role: 'Admin' }, process.env.JWT_SECRET, { algorithm: 'HS256' });

        await request(app).post('/api/bookings').set(auth(escalated)).send({ gigId: 'x' }).expect(403);
    });

    it('refuses a token belonging to a deleted account', async () => {
        const { token, user } = await createFreelancer();
        await User.deleteOne({ _id: user.id });

        await request(app).get('/api/auth/me').set(auth(token)).expect(401);
    });
});

describe('error handling', () => {
    it('returns 404 JSON for an unknown route', async () => {
        const response = await request(app).get('/api/does-not-exist').expect(404);
        expect(response.body.message).toBeDefined();
        expect(response.text).not.toMatch(/at .*\(.*:\d+:\d+\)/); // No stack trace
    });

    it('returns 400 for malformed JSON', async () => {
        await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email": "broken"')
            .expect(400);
    });

    it('rejects a body larger than the 10 KB limit', async () => {
        const freelancer = await createFreelancer();

        await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: 'Logo design work',
                description: 'x'.repeat(20000),
                category: 'Design',
                price: 1500,
                deliveryDays: 3
            })
            .expect(413);
    });
});

describe('sensitive data', () => {
    it('never returns a password hash from any endpoint', async () => {
        const { token } = await createFreelancer();

        const profile = await request(app).get('/api/auth/me').set(auth(token)).expect(200);
        expect(JSON.stringify(profile.body)).not.toContain('$2b$');
        expect(JSON.stringify(profile.body)).not.toContain(PASSWORD);
        expect(profile.body.user.failedLoginAttempts).toBeUndefined();
        expect(profile.body.user.lockUntil).toBeUndefined();
    });
});
