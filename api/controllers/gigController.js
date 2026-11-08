const mongoose = require('mongoose');
const Gig = require('../models/Gig');
const { logEvent, logSecurity } = require('../utils/logger');

const EDITABLE_FIELDS = ['title', 'description', 'category', 'price', 'deliveryDays'];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isOwner = (gig, userId) => gig.freelancer.toString() === userId;

// @desc    Browse all gigs (optional search and category filter)
// @route   GET /api/gigs
// @access  Private (any authenticated user)
const listGigs = async (req, res) => {
    const filter = {};
    const { category } = req.query;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (category) {
        filter.category = category;
    }
    if (search) {
        // Search term is regex-escaped; trusted() marks this server-built operator as safe for sanitizeFilter
        const pattern = mongoose.trusted({ $regex: escapeRegex(search), $options: 'i' });
        filter.$or = [{ title: pattern }, { description: pattern }];
    }

    const gigs = await Gig.find(filter)
        .populate('freelancer', 'username')
        .sort({ createdAt: -1 })
        .limit(50);

    return res.status(200).json({ count: gigs.length, gigs });
};

// @desc    Get the logged-in freelancer's own gigs
// @route   GET /api/gigs/mine
// @access  Private (Freelancer)
const getMyGigs = async (req, res) => {
    const gigs = await Gig.find({ freelancer: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ count: gigs.length, gigs });
};

// @desc    Get a single gig
// @route   GET /api/gigs/:id
// @access  Private (any authenticated user)
const getGigById = async (req, res) => {
    const gig = await Gig.findById(req.params.id).populate('freelancer', 'username');
    if (!gig) {
        return res.status(404).json({ message: 'Gig not found.' });
    }
    return res.status(200).json({ gig });
};

// @desc    Create a gig
// @route   POST /api/gigs
// @access  Private (Freelancer)
const createGig = async (req, res) => {
    /* eslint-disable security/detect-object-injection --
       `field` is drawn from the EDITABLE_FIELDS whitelist defined in this file,
       so no request-controlled key is ever used as a lookup. */
    const data = {};
    EDITABLE_FIELDS.forEach(field => { data[field] = req.body[field]; });
    /* eslint-enable security/detect-object-injection */

    // Owner always comes from the verified token, never from the request body
    const gig = await Gig.create({ ...data, freelancer: req.user.id });
    logEvent(req, 'gig.created', { gigId: gig._id.toString(), price: gig.price, gigCategory: gig.category });

    return res.status(201).json({ message: 'Gig created successfully.', gig });
};

// @desc    Update own gig
// @route   PUT /api/gigs/:id
// @access  Private (Freelancer, owner only)
const updateGig = async (req, res) => {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
        return res.status(404).json({ message: 'Gig not found.' });
    }
    if (!isOwner(gig, req.user.id)) {
        logSecurity(req, 'access.denied.ownership', { resource: 'gig', action: 'update', gigId: gig._id.toString() });
        return res.status(403).json({ message: 'Forbidden: you can only modify your own gigs.' });
    }

    /* eslint-disable security/detect-object-injection --
       `field` comes from the EDITABLE_FIELDS whitelist, so a request cannot
       reach any property that is not explicitly editable. */
    EDITABLE_FIELDS.forEach(field => {
        if (req.body[field] !== undefined) gig[field] = req.body[field];
    });
    /* eslint-enable security/detect-object-injection */
    await gig.save();
    // eslint-disable-next-line security/detect-object-injection -- `f` is from the EDITABLE_FIELDS whitelist
    const changed = EDITABLE_FIELDS.filter(f => req.body[f] !== undefined);
    logEvent(req, 'gig.updated', { gigId: gig._id.toString(), fields: changed });

    return res.status(200).json({ message: 'Gig updated successfully.', gig });
};

// @desc    Delete own gig
// @route   DELETE /api/gigs/:id
// @access  Private (Freelancer, owner only)
const deleteGig = async (req, res) => {
    const gig = await Gig.findById(req.params.id);
    if (!gig) {
        return res.status(404).json({ message: 'Gig not found.' });
    }
    if (!isOwner(gig, req.user.id)) {
        logSecurity(req, 'access.denied.ownership', { resource: 'gig', action: 'delete', gigId: gig._id.toString() });
        return res.status(403).json({ message: 'Forbidden: you can only delete your own gigs.' });
    }

    await gig.deleteOne();
    logEvent(req, 'gig.deleted', { gigId: gig._id.toString() });
    return res.status(200).json({ message: 'Gig deleted successfully.' });
};

module.exports = { listGigs, getMyGigs, getGigById, createGig, updateGig, deleteGig };
