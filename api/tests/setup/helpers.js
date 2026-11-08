const request = require('supertest');
const app = require('../../app');

const PASSWORD = 'Str0ng!Pass';

// Registers a user and logs them in, returning the token and profile the rest of
// the suite needs. Keeping this in one place means a change to the auth contract
// only has to be fixed once.
const createUser = async ({ username, email, role, password = PASSWORD }) => {
    await request(app)
        .post('/api/auth/register')
        .send({ username, email, password, role })
        .expect(201);

    const login = await request(app)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

    return { token: login.body.token, user: login.body.user, password };
};

const createFreelancer = (suffix = '') =>
    createUser({ username: `sipho${suffix}`, email: `sipho${suffix}@test.com`, role: 'Freelancer' });

const createClient = (suffix = '') =>
    createUser({ username: `thandi${suffix}`, email: `thandi${suffix}@test.com`, role: 'Client' });

// Creates a gig owned by the given freelancer
const createGig = async (token, overrides = {}) => {
    const response = await request(app)
        .post('/api/gigs')
        .set('Authorization', `Bearer ${token}`)
        .send({
            title: 'Logo design',
            description: 'A clean, modern logo delivered as SVG and PNG files.',
            category: 'Design',
            price: 1500,
            deliveryDays: 3,
            ...overrides
        })
        .expect(201);

    return response.body.gig;
};

// Books a gig as the client, which also records the transaction
const bookGig = async (clientToken, gigId) => {
    const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ gigId, confirmPayment: true })
        .expect(201);

    return response.body;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, PASSWORD, createUser, createFreelancer, createClient, createGig, bookGig, auth };
