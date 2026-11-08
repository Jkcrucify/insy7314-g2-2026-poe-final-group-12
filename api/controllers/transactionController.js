const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const { ROLES } = require('../utils/constants');
const { estimateTax, getTaxYear, AGE_GROUPS } = require('../utils/tax');
const { logEvent } = require('../utils/logger');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// @desc    Get transactions for the logged-in user
// @route   GET /api/transactions/mine
// @access  Private
const getMyTransactions = async (req, res) => {
    const filter = req.user.role === ROLES.FREELANCER
        ? { freelancer: req.user.id }
        : { client: req.user.id };

    const transactions = await Transaction.find(filter)
        .populate('client', 'username')
        .populate('freelancer', 'username')
        .populate('booking', 'gigTitle status')
        .sort({ createdAt: -1 });

    return res.status(200).json({ count: transactions.length, transactions });
};

// Builds the full 12 months of the tax year (March -> February) so the chart always
// has a complete axis, with zeroes for months in which nothing was earned.
const buildMonthlySeries = (taxYear, rows) => {
    const byKey = new Map(rows.map(r => [`${r._id.year}-${r._id.month}`, r]));
    const months = [];

    for (let offset = 0; offset < 12; offset += 1) {
        const date = new Date(Date.UTC(taxYear.start.getUTCFullYear(), taxYear.start.getUTCMonth() + offset, 1));
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1; // MongoDB $month is 1-based
        const row = byKey.get(`${year}-${month}`);

        months.push({
            key: `${year}-${String(month).padStart(2, '0')}`,
            label: `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`,
            income: row ? Math.round(row.income * 100) / 100 : 0,
            transactions: row ? row.count : 0
        });
    }

    return months;
};

// @desc    Income and tax summary for the logged-in freelancer
// @route   GET /api/transactions/income?expenses=0&ageGroup=under65
// @access  Private (Freelancer)
const getIncomeSummary = async (req, res) => {
    const freelancerId = new mongoose.Types.ObjectId(req.user.id);
    const taxYear = getTaxYear(new Date());

    // Validated upstream; the fallbacks keep the endpoint safe if it is ever called directly
    const expenses = Number(req.query.expenses) || 0;
    const ageGroup = Object.values(AGE_GROUPS).includes(req.query.ageGroup)
        ? req.query.ageGroup
        : AGE_GROUPS.UNDER_65;

    // One pass over the freelancer's successful transactions produces both the
    // all-time totals and the per-month series for the current tax year.
    const [result] = await Transaction.aggregate([
        { $match: { freelancer: freelancerId, status: 'Success' } },
        {
            $facet: {
                allTime: [
                    { $group: { _id: null, totalIncome: { $sum: '$amount' }, count: { $sum: 1 } } }
                ],
                taxYear: [
                    { $match: { createdAt: { $gte: taxYear.start, $lt: taxYear.end } } },
                    { $group: { _id: null, totalIncome: { $sum: '$amount' }, count: { $sum: 1 } } }
                ],
                monthly: [
                    { $match: { createdAt: { $gte: taxYear.start, $lt: taxYear.end } } },
                    {
                        $group: {
                            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                            income: { $sum: '$amount' },
                            count: { $sum: 1 }
                        }
                    }
                ],
                topGigs: [
                    { $match: { createdAt: { $gte: taxYear.start, $lt: taxYear.end } } },
                    {
                        $lookup: {
                            from: 'bookings',
                            localField: 'booking',
                            foreignField: '_id',
                            as: 'bookingDoc'
                        }
                    },
                    { $unwind: '$bookingDoc' },
                    {
                        $group: {
                            _id: '$bookingDoc.gigTitle',
                            income: { $sum: '$amount' },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { income: -1 } },
                    { $limit: 5 }
                ]
            }
        }
    ]);

    const allTime = result.allTime[0] || { totalIncome: 0, count: 0 };
    const currentYear = result.taxYear[0] || { totalIncome: 0, count: 0 };

    const tax = estimateTax({ grossIncome: currentYear.totalIncome, expenses, ageGroup });

    logEvent(req, 'income.summary.viewed', {
        taxYear: taxYear.label,
        taxYearIncome: tax.grossIncome,
        estimatedTax: tax.taxPayable
    });

    return res.status(200).json({
        freelancer: req.user.username,
        currency: 'ZAR',
        // All-time figures, kept for the existing dashboard tiles
        totalIncome: allTime.totalIncome,
        transactionCount: allTime.count,
        taxYear: {
            label: taxYear.label,
            tableLabel: taxYear.tableLabel,
            start: taxYear.start,
            end: taxYear.end,
            income: currentYear.totalIncome,
            transactionCount: currentYear.count
        },
        monthly: buildMonthlySeries(taxYear, result.monthly),
        topGigs: result.topGigs.map(g => ({
            title: g._id,
            income: g.income,
            count: g.count
        })),
        tax
    });
};

module.exports = { getMyTransactions, getIncomeSummary };
