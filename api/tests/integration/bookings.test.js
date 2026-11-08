const { app, request, auth, createFreelancer, createClient, createGig, bookGig } = require('../setup/helpers');
const Booking = require('../../models/Booking');
const Transaction = require('../../models/Transaction');

describe('creating a booking', () => {
    it('records a booking and its transaction together', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token);

        const result = await bookGig(client.token, gig._id);

        expect(result.transaction.reference).toMatch(/^HH-/);
        expect(await Booking.countDocuments()).toBe(1);
        expect(await Transaction.countDocuments()).toBe(1);

        const transaction = await Transaction.findOne();
        expect(transaction.booking.toString()).toBe(result.booking._id);
        expect(transaction.status).toBe('Success');
    });

    it('takes the amount from the database, not from the request body', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 1500 });

        await request(app)
            .post('/api/bookings')
            .set(auth(client.token))
            .send({ gigId: gig._id, confirmPayment: true, amount: 1, price: 1 })
            .expect(201);

        const transaction = await Transaction.findOne();
        expect(transaction.amount).toBe(1500);
    });

    it('requires the simulated payment to be confirmed', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token);

        await request(app)
            .post('/api/bookings')
            .set(auth(client.token))
            .send({ gigId: gig._id })
            .expect(400);

        expect(await Booking.countDocuments()).toBe(0);
        expect(await Transaction.countDocuments()).toBe(0);
    });

    it('stops a freelancer booking a gig (403)', async () => {
        const freelancer = await createFreelancer();
        const other = await createFreelancer('2');
        const gig = await createGig(freelancer.token);

        await request(app)
            .post('/api/bookings')
            .set(auth(other.token))
            .send({ gigId: gig._id, confirmPayment: true })
            .expect(403);
    });

    it('returns 404 for a gig that does not exist', async () => {
        const client = await createClient();

        await request(app)
            .post('/api/bookings')
            .set(auth(client.token))
            .send({ gigId: '507f1f77bcf86cd799439011', confirmPayment: true })
            .expect(404);
    });

    it('rejects a booking without a token', async () => {
        await request(app).post('/api/bookings').send({ gigId: 'x', confirmPayment: true }).expect(401);
    });
});

describe('viewing bookings', () => {
    it('shows each participant only their own bookings', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const outsider = await createClient('2');
        const gig = await createGig(freelancer.token);
        await bookGig(client.token, gig._id);

        const asClient = await request(app).get('/api/bookings/mine').set(auth(client.token)).expect(200);
        const asFreelancer = await request(app).get('/api/bookings/mine').set(auth(freelancer.token)).expect(200);
        const asOutsider = await request(app).get('/api/bookings/mine').set(auth(outsider.token)).expect(200);

        expect(asClient.body.bookings).toHaveLength(1);
        expect(asFreelancer.body.bookings).toHaveLength(1);
        expect(asOutsider.body.bookings).toHaveLength(0);
    });

    it('stops a non-participant reading a booking by id (403)', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const outsider = await createClient('2');
        const gig = await createGig(freelancer.token);
        const { booking } = await bookGig(client.token, gig._id);

        await request(app).get(`/api/bookings/${booking._id}`).set(auth(client.token)).expect(200);
        await request(app).get(`/api/bookings/${booking._id}`).set(auth(freelancer.token)).expect(200);
        await request(app).get(`/api/bookings/${booking._id}`).set(auth(outsider.token)).expect(403);
    });
});

describe('viewing transactions', () => {
    it('shows each side of the transaction to the right user only', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const outsider = await createClient('2');
        const gig = await createGig(freelancer.token);
        await bookGig(client.token, gig._id);

        const asClient = await request(app).get('/api/transactions/mine').set(auth(client.token)).expect(200);
        const asFreelancer = await request(app).get('/api/transactions/mine').set(auth(freelancer.token)).expect(200);
        const asOutsider = await request(app).get('/api/transactions/mine').set(auth(outsider.token)).expect(200);

        expect(asClient.body.count).toBe(1);
        expect(asFreelancer.body.count).toBe(1);
        expect(asOutsider.body.count).toBe(0);
    });
});
