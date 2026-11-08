/**
 * Seeds a demo freelancer whose income is spread across the current tax year,
 * so the Income and tax page has a realistic twelve-month series to chart.
 *
 * A freshly registered account has income in one month only, which makes the
 * monthly chart and the per-bracket split look empty during a demonstration.
 *
 * Run it against the containerised stack:
 *   docker compose exec -e SEED_DEMO=yes api node scripts/seed-demo.js
 *
 * Running it again replaces the demo data; nothing else in the database is
 * touched. It refuses to run unless SEED_DEMO=yes, so it cannot be triggered
 * by accident against real data.
 */

const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Gig = require('../models/Gig');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { getTaxYear } = require('../utils/tax');

// Matches the cost factor used when a real account registers
const SALT_ROUNDS = 12;
const PASSWORD = 'Demo!Pass123';

const FREELANCER_EMAIL = 'demo.freelancer@hustlehub.test';
const CLIENT_EMAIL = 'demo.client@hustlehub.test';

const GIGS = [
    {
        title: 'Brand identity package',
        description: 'A full brand identity: logo, colour palette, typography and a usage guide.',
        category: 'Design',
        price: 45000,
        deliveryDays: 14
    },
    {
        title: 'React dashboard build',
        description: 'A responsive React dashboard with charts, authentication and role-based access.',
        category: 'Development',
        price: 62000,
        deliveryDays: 21
    },
    {
        title: 'Launch campaign copy',
        description: 'Landing page, email sequence and social copy for a product launch campaign.',
        category: 'Writing',
        price: 24000,
        deliveryDays: 7
    },
    {
        title: 'Explainer video production',
        description: 'A scripted ninety-second explainer video with voiceover, motion graphics and music.',
        category: 'Video & Animation',
        price: 39000,
        deliveryDays: 18
    }
];

// Month offsets from the start of the tax year (0 = March), the gig booked and
// the amount. Chosen so the year totals R412 000, which reaches the third
// bracket and therefore shows three bands in the per-bracket split.
const BOOKINGS = [
    { monthOffset: 0, gig: 0, amount: 45000 },
    { monthOffset: 1, gig: 2, amount: 28000 },
    { monthOffset: 2, gig: 1, amount: 62000 },
    { monthOffset: 3, gig: 3, amount: 35000 },
    { monthOffset: 4, gig: 1, amount: 51000 },
    { monthOffset: 5, gig: 2, amount: 24000 },
    { monthOffset: 6, gig: 1, amount: 68000 },
    { monthOffset: 7, gig: 0, amount: 39000 },
    { monthOffset: 8, gig: 3, amount: 60000 }
];

const reference = (index) =>
    'HH-SEED' + String(index).padStart(2, '0') + '-' +
    Math.random().toString(16).slice(2, 10).toUpperCase();

const rand = (amount) => 'R' + amount.toLocaleString('en-ZA');

const main = async () => {
    if (process.env.SEED_DEMO !== 'yes') {
        console.error('Refusing to run. Set SEED_DEMO=yes to confirm you want to seed demo data:');
        console.error('  docker compose exec -e SEED_DEMO=yes api node scripts/seed-demo.js');
        process.exitCode = 1;
        return;
    }

    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('MONGO_URI is not set.');
        process.exitCode = 1;
        return;
    }

    await mongoose.connect(uri);
    console.log('Connected to ' + mongoose.connection.name);

    // --- Replace any previous demo data, and nothing else ---------------------
    const existing = await User.find({ email: { $in: [FREELANCER_EMAIL, CLIENT_EMAIL] } }).select('_id');
    if (existing.length) {
        const ids = existing.map(user => user._id);
        const [transactions, bookings, gigs, users] = await Promise.all([
            Transaction.deleteMany({ $or: [{ freelancer: { $in: ids } }, { client: { $in: ids } }] }),
            Booking.deleteMany({ $or: [{ freelancer: { $in: ids } }, { client: { $in: ids } }] }),
            Gig.deleteMany({ freelancer: { $in: ids } }),
            User.deleteMany({ _id: { $in: ids } })
        ]);
        console.log(
            'Cleared previous demo data: ' +
            transactions.deletedCount + ' transactions, ' +
            bookings.deletedCount + ' bookings, ' +
            gigs.deletedCount + ' gigs, ' +
            users.deletedCount + ' users'
        );
    }

    const hashedPassword = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
    const [freelancer, client] = await User.create([
        { username: 'demofreelancer', email: FREELANCER_EMAIL, password: hashedPassword, role: 'Freelancer' },
        { username: 'democlient', email: CLIENT_EMAIL, password: hashedPassword, role: 'Client' }
    ]);

    const gigs = await Gig.create(GIGS.map(gig => ({ ...gig, freelancer: freelancer._id })));

    const taxYear = getTaxYear(new Date());
    const startYear = taxYear.start.getUTCFullYear();
    const startMonth = taxYear.start.getUTCMonth();

    let total = 0;
    for (const [index, spec] of BOOKINGS.entries()) {
        const gig = gigs[spec.gig];
        // Mid-month, in UTC, so the month never shifts with the server timezone
        const when = new Date(Date.UTC(startYear, startMonth + spec.monthOffset, 15, 10, 0, 0));

        const booking = await Booking.create({
            gig: gig._id,
            gigTitle: gig.title,
            client: client._id,
            freelancer: freelancer._id,
            amount: spec.amount,
            status: 'Completed',
            notes: 'Seeded for the demonstration'
        });

        const transaction = await Transaction.create({
            reference: reference(index),
            booking: booking._id,
            client: client._id,
            freelancer: freelancer._id,
            amount: spec.amount,
            status: 'Success'
        });

        // Mongoose ignores a createdAt passed to create() while timestamps are on,
        // so backdate through the driver. The income aggregation groups on createdAt.
        const targets = [[Booking, booking._id], [Transaction, transaction._id]];
        for (const [model, id] of targets) {
            const { modifiedCount } = await model.collection.updateOne(
                { _id: id },
                { $set: { createdAt: when, updatedAt: when } }
            );
            if (modifiedCount !== 1) {
                throw new Error('Failed to backdate ' + model.modelName + ' ' + id);
            }
        }

        total += spec.amount;
        console.log('  ' + when.toISOString().slice(0, 7) + '  ' + rand(spec.amount) + '  ' + gig.title);
    }

    const months = new Set(BOOKINGS.map(booking => booking.monthOffset)).size;

    console.log('');
    console.log('Tax year ' + taxYear.label + ' (tables ' + taxYear.tableLabel + ')');
    console.log('Seeded ' + BOOKINGS.length + ' bookings across ' + months + ' months, ' + rand(total) + ' in total');
    console.log('');
    console.log('Sign in at http://localhost:8080');
    console.log('  Freelancer : ' + FREELANCER_EMAIL + '  /  ' + PASSWORD);
    console.log('  Client     : ' + CLIENT_EMAIL + '  /  ' + PASSWORD);

    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
});
