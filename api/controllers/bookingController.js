const crypto = require('crypto');
const mongoose = require('mongoose');
const Gig = require('../models/Gig');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { ROLES } = require('../utils/constants');
const { logEvent, logSecurity } = require('../utils/logger');

const generateReference = () =>
    `HH-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Populated users can be null if an account was removed, so compare defensively
const isParticipant = (booking, userId) =>
    booking.client?._id?.toString() === userId || booking.freelancer?._id?.toString() === userId;

// @desc    Book a gig (simulated payment) and record the transaction
// @route   POST /api/bookings
// @access  Private (Client)
const createBooking = async (req, res) => {
    const { gigId, notes = '' } = req.body;

    const gig = await Gig.findById(gigId);
    if (!gig) {
        return res.status(404).json({ message: 'Gig not found.' });
    }

    let booking;
    let transaction;
    const session = await mongoose.startSession();
    try {
        // Booking and transaction are written atomically: both succeed or neither does
        await session.withTransaction(async () => {
            [booking] = await Booking.create([{
                gig: gig._id,
                gigTitle: gig.title,
                client: req.user.id,
                freelancer: gig.freelancer,
                amount: gig.price, // Price comes from the database, never from the client
                notes
            }], { session });

            [transaction] = await Transaction.create([{
                reference: generateReference(),
                booking: booking._id,
                client: req.user.id,
                freelancer: gig.freelancer,
                amount: gig.price
            }], { session });
        });
    } catch (error) {
        logEvent(req, 'booking.failed', { gigId: gig._id.toString(), error: error.message }, 'error');
        throw error;
    } finally {
        await session.endSession();
    }

    logEvent(req, 'booking.created', {
        bookingId: booking._id.toString(),
        gigId: gig._id.toString(),
        freelancerId: gig.freelancer.toString(),
        amount: booking.amount
    });
    logEvent(req, 'transaction.recorded', {
        transactionId: transaction._id.toString(),
        reference: transaction.reference,
        bookingId: booking._id.toString(),
        clientId: req.user.id,
        freelancerId: gig.freelancer.toString(),
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod
    });

    return res.status(201).json({
        message: 'Booking confirmed. Simulated payment successful.',
        booking,
        transaction
    });
};

// @desc    Get bookings for the logged-in user (client: made, freelancer: received)
// @route   GET /api/bookings/mine
// @access  Private
const getMyBookings = async (req, res) => {
    const filter = req.user.role === ROLES.FREELANCER
        ? { freelancer: req.user.id }
        : { client: req.user.id };

    const bookings = await Booking.find(filter)
        .populate('client', 'username')
        .populate('freelancer', 'username')
        .sort({ createdAt: -1 })
        .lean();

    // Attach the transaction reference for each booking
    const transactions = await Transaction.find({
        booking: mongoose.trusted({ $in: bookings.map(b => b._id) })
    }).lean();
    const refByBooking = new Map(transactions.map(t => [t.booking.toString(), t.reference]));

    const result = bookings.map(({ __v, ...b }) => ({
        ...b,
        transactionReference: refByBooking.get(b._id.toString()) || null
    }));

    return res.status(200).json({ count: result.length, bookings: result });
};

// @desc    Get a single booking (participants only)
// @route   GET /api/bookings/:id
// @access  Private (booking client or freelancer)
const getBookingById = async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate('client', 'username')
        .populate('freelancer', 'username');

    if (!booking) {
        return res.status(404).json({ message: 'Booking not found.' });
    }
    if (!isParticipant(booking, req.user.id)) {
        logSecurity(req, 'access.denied.ownership', { resource: 'booking', action: 'read', bookingId: booking._id.toString() });
        return res.status(403).json({ message: 'Forbidden: you do not have access to this booking.' });
    }

    const transaction = await Transaction.findOne({ booking: booking._id });
    return res.status(200).json({ booking, transaction });
};

module.exports = { createBooking, getMyBookings, getBookingById };
