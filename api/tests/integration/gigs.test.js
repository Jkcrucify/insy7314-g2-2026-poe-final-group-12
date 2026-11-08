const { app, request, auth, createFreelancer, createClient, createGig } = require('../setup/helpers');
const Gig = require('../../models/Gig');

describe('gig access control', () => {
    it('refuses to list gigs without a token', async () => {
        await request(app).get('/api/gigs').expect(401);
    });

    it('refuses to create a gig without a token', async () => {
        await request(app).post('/api/gigs').send({ title: 'Nope' }).expect(401);
    });

    it('stops a client creating a gig (403)', async () => {
        const client = await createClient();

        await request(app)
            .post('/api/gigs')
            .set(auth(client.token))
            .send({
                title: 'Logo design',
                description: 'A clean, modern logo delivered as SVG and PNG.',
                category: 'Design',
                price: 1500,
                deliveryDays: 3
            })
            .expect(403);

        expect(await Gig.countDocuments()).toBe(0);
    });
});

describe('gig creation and validation', () => {
    it('lets a freelancer create a gig they own', async () => {
        const freelancer = await createFreelancer();
        const gig = await createGig(freelancer.token);

        expect(gig.title).toBe('Logo design');
        const stored = await Gig.findById(gig._id);
        expect(stored.freelancer.toString()).toBe(freelancer.user.id);
    });

    it('rejects a negative price and a missing category', async () => {
        const freelancer = await createFreelancer();

        const negativePrice = await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: 'Logo design',
                description: 'A clean, modern logo delivered as SVG and PNG.',
                category: 'Design',
                price: -100,
                deliveryDays: 3
            })
            .expect(400);

        expect(negativePrice.body.errors.map(e => e.field)).toContain('price');

        await request(app)
            .post('/api/gigs')
            .set(auth(freelancer.token))
            .send({
                title: 'Logo design',
                description: 'A clean, modern logo delivered as SVG and PNG.',
                category: 'Hacking',
                price: 100,
                deliveryDays: 3
            })
            .expect(400);
    });

    it('strips HTML from a gig title and description', async () => {
        const freelancer = await createFreelancer();
        const gig = await createGig(freelancer.token, {
            title: 'Logo <script>alert(1)</script>design',
            description: '<img src=x onerror=alert(1)>A clean, modern logo delivered as files.'
        });

        expect(gig.title).not.toContain('<script>');
        expect(gig.description).not.toContain('<img');
        expect(gig.title).toContain('Logo');
    });

    it('rejects a gig id that is not a valid ObjectId', async () => {
        const freelancer = await createFreelancer();
        await request(app).get('/api/gigs/not-an-id').set(auth(freelancer.token)).expect(400);
    });
});

describe('gig ownership', () => {
    it('stops a freelancer editing another freelancer\'s gig', async () => {
        const owner = await createFreelancer('1');
        const other = await createFreelancer('2');
        const gig = await createGig(owner.token);

        await request(app)
            .put(`/api/gigs/${gig._id}`)
            .set(auth(other.token))
            .send({ price: 99 })
            .expect(403);

        const unchanged = await Gig.findById(gig._id);
        expect(unchanged.price).toBe(1500);
    });

    it('stops a freelancer deleting another freelancer\'s gig', async () => {
        const owner = await createFreelancer('1');
        const other = await createFreelancer('2');
        const gig = await createGig(owner.token);

        await request(app).delete(`/api/gigs/${gig._id}`).set(auth(other.token)).expect(403);
        expect(await Gig.exists({ _id: gig._id })).not.toBeNull();
    });

    it('lets the owner update and delete their own gig', async () => {
        const owner = await createFreelancer();
        const gig = await createGig(owner.token);

        await request(app)
            .put(`/api/gigs/${gig._id}`)
            .set(auth(owner.token))
            .send({ price: 2000 })
            .expect(200);

        await request(app).delete(`/api/gigs/${gig._id}`).set(auth(owner.token)).expect(200);
        expect(await Gig.exists({ _id: gig._id })).toBeNull();
    });

    it('returns only the caller\'s own gigs from /api/gigs/mine', async () => {
        const first = await createFreelancer('1');
        const second = await createFreelancer('2');
        await createGig(first.token, { title: 'First gig' });
        await createGig(second.token, { title: 'Second gig' });

        const response = await request(app).get('/api/gigs/mine').set(auth(first.token)).expect(200);

        expect(response.body.gigs).toHaveLength(1);
        expect(response.body.gigs[0].title).toBe('First gig');
    });
});

describe('gig search', () => {
    it('filters by keyword and by category', async () => {
        const freelancer = await createFreelancer();
        await createGig(freelancer.token, { title: 'Logo design', category: 'Design' });
        await createGig(freelancer.token, { title: 'React website build', category: 'Development' });

        const byKeyword = await request(app).get('/api/gigs?search=React').set(auth(freelancer.token)).expect(200);
        expect(byKeyword.body.gigs).toHaveLength(1);
        expect(byKeyword.body.gigs[0].title).toBe('React website build');

        const byCategory = await request(app).get('/api/gigs?category=Design').set(auth(freelancer.token)).expect(200);
        expect(byCategory.body.gigs).toHaveLength(1);
        expect(byCategory.body.gigs[0].category).toBe('Design');
    });
});
