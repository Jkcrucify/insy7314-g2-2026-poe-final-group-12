const { app, request, auth, createFreelancer, createClient, createGig, bookGig } = require('../setup/helpers');
const Transaction = require('../../models/Transaction');
const { getTaxYear, estimateTax } = require('../../utils/tax');

// Moves a transaction into a specific month so the monthly series can be checked.
// The raw driver is used so Mongoose's timestamp handling does not overwrite the
// value we are deliberately setting.
const backdateTransactions = async (date) => {
    const result = await Transaction.collection.updateMany({}, { $set: { createdAt: date } });
    expect(result.modifiedCount).toBeGreaterThan(0);
};

describe('GET /api/transactions/income', () => {
    it('is refused without a token', async () => {
        await request(app).get('/api/transactions/income').expect(401);
    });

    it('is refused for a client (403)', async () => {
        const client = await createClient();
        await request(app).get('/api/transactions/income').set(auth(client.token)).expect(403);
    });

    it('reports zero income and no tax for a new freelancer', async () => {
        const freelancer = await createFreelancer();
        const response = await request(app)
            .get('/api/transactions/income')
            .set(auth(freelancer.token))
            .expect(200);

        expect(response.body.totalIncome).toBe(0);
        expect(response.body.tax.taxPayable).toBe(0);
        expect(response.body.tax.belowThreshold).toBe(true);
        expect(response.body.monthly).toHaveLength(12);
        expect(response.body.monthly.every(m => m.income === 0)).toBe(true);
    });

    it('counts only the signed-in freelancer\'s income', async () => {
        const earner = await createFreelancer('1');
        const other = await createFreelancer('2');
        const client = await createClient();
        const gig = await createGig(earner.token, { price: 2000 });
        await bookGig(client.token, gig._id);

        const earned = await request(app).get('/api/transactions/income').set(auth(earner.token)).expect(200);
        const none = await request(app).get('/api/transactions/income').set(auth(other.token)).expect(200);

        expect(earned.body.totalIncome).toBe(2000);
        expect(none.body.totalIncome).toBe(0);
    });

    it('matches the tax engine for the income it reports', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 50000 });
        await bookGig(client.token, gig._id);
        await bookGig(client.token, gig._id);
        await bookGig(client.token, gig._id);

        const response = await request(app)
            .get('/api/transactions/income')
            .set(auth(freelancer.token))
            .expect(200);

        const expected = estimateTax({ grossIncome: 150000 });
        expect(response.body.taxYear.income).toBe(150000);
        expect(response.body.tax.taxPayable).toBe(expected.taxPayable);
        expect(response.body.tax.netIncome).toBe(expected.netIncome);
    });

    it('places income in the right month of the tax year', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 1000 });
        await bookGig(client.token, gig._id);

        const taxYear = getTaxYear(new Date());
        // Third month of the tax year (March is the first), kept inside the window
        const target = new Date(Date.UTC(taxYear.start.getUTCFullYear(), taxYear.start.getUTCMonth() + 2, 15));
        await backdateTransactions(target);

        const response = await request(app)
            .get('/api/transactions/income')
            .set(auth(freelancer.token))
            .expect(200);

        expect(response.body.monthly[2].income).toBe(1000);
        expect(response.body.monthly[2].transactions).toBe(1);
        expect(response.body.monthly.filter(m => m.income > 0)).toHaveLength(1);
    });

    it('excludes income earned in a previous tax year from the tax estimate', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 90000 });
        await bookGig(client.token, gig._id);

        const taxYear = getTaxYear(new Date());
        await backdateTransactions(new Date(taxYear.start.getTime() - 86400000)); // The day before

        const response = await request(app)
            .get('/api/transactions/income')
            .set(auth(freelancer.token))
            .expect(200);

        expect(response.body.totalIncome).toBe(90000); // All-time total still counts it
        expect(response.body.taxYear.income).toBe(0);  // This tax year does not
        expect(response.body.tax.taxPayable).toBe(0);
    });

    it('reduces the tax estimate when expenses are supplied', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 100000 });
        await bookGig(client.token, gig._id);
        await bookGig(client.token, gig._id);

        const plain = await request(app).get('/api/transactions/income').set(auth(freelancer.token)).expect(200);
        const withExpenses = await request(app)
            .get('/api/transactions/income?expenses=50000')
            .set(auth(freelancer.token))
            .expect(200);

        expect(withExpenses.body.tax.taxableIncome).toBe(150000);
        expect(withExpenses.body.tax.taxPayable).toBeLessThan(plain.body.tax.taxPayable);
    });

    it('gives an older freelancer a larger rebate', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const gig = await createGig(freelancer.token, { price: 100000 });
        await bookGig(client.token, gig._id);
        await bookGig(client.token, gig._id);

        const under65 = await request(app).get('/api/transactions/income').set(auth(freelancer.token)).expect(200);
        const over75 = await request(app)
            .get('/api/transactions/income?ageGroup=75plus')
            .set(auth(freelancer.token))
            .expect(200);

        expect(over75.body.tax.rebate).toBeGreaterThan(under65.body.tax.rebate);
        expect(over75.body.tax.taxPayable).toBeLessThan(under65.body.tax.taxPayable);
    });

    it('rejects invalid query parameters instead of coercing them', async () => {
        const freelancer = await createFreelancer();

        await request(app).get('/api/transactions/income?expenses=abc').set(auth(freelancer.token)).expect(400);
        await request(app).get('/api/transactions/income?expenses=-1').set(auth(freelancer.token)).expect(400);
        await request(app).get('/api/transactions/income?ageGroup=wizard').set(auth(freelancer.token)).expect(400);
    });

    it('ranks the top earning gigs', async () => {
        const freelancer = await createFreelancer();
        const client = await createClient();
        const small = await createGig(freelancer.token, { title: 'Small gig', price: 500 });
        const big = await createGig(freelancer.token, { title: 'Big gig', price: 5000 });
        await bookGig(client.token, small._id);
        await bookGig(client.token, big._id);

        const response = await request(app)
            .get('/api/transactions/income')
            .set(auth(freelancer.token))
            .expect(200);

        expect(response.body.topGigs[0]).toMatchObject({ title: 'Big gig', income: 5000, count: 1 });
        expect(response.body.topGigs[1]).toMatchObject({ title: 'Small gig', income: 500 });
    });
});
