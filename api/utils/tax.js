// -----------------------------------------------------------------------------
// Income tax estimation (South African Revenue Service individual tax tables)
// -----------------------------------------------------------------------------
// HustleHub+ freelancers are sole proprietors: gig income is taxed as personal
// income, not company income. This module turns the income recorded in the
// Transaction collection into an approximate annual tax figure using the
// published SARS tables.
//
// How the calculation works, step by step:
//   1. Taxable income   = gross income earned in the tax year - deductible expenses.
//   2. Gross tax        = the bracket's fixed base amount + (bracket rate x the
//                         income above the bracket's lower edge). The tables are
//                         cumulative, so only the slice inside each bracket is
//                         taxed at that bracket's rate ("marginal" taxation).
//   3. Tax payable      = gross tax - the age rebate, floored at zero. Someone
//                         under the tax threshold therefore pays nothing.
//   4. Effective rate   = tax payable / taxable income (what is actually paid);
//      marginal rate    = the rate charged on the next rand earned.
//   5. Provisional tax  = sole proprietors pay in two instalments (end of August
//                         and end of February), so the estimate is halved.
//
// This is a good-faith estimate for planning only, not a tax return. It assumes
// the freelancer has no other income, is a South African tax resident, and is
// not registered for VAT.
// -----------------------------------------------------------------------------

const AGE_GROUPS = Object.freeze({
    UNDER_65: 'under65',
    AGE_65_TO_74: '65to74',
    AGE_75_PLUS: '75plus'
});

// SARS tax tables for the 2025/2026 year of assessment (1 March 2025 - 28 February 2026).
// `base` is the cumulative tax owed at `from`; `rate` applies to income above `from`.
const TAX_TABLE = Object.freeze({
    label: '2025/2026',
    // The South African tax year starts on 1 March (month index 2) and ends on the last day of February
    startMonth: 2,
    brackets: Object.freeze([
        { from: 0, to: 237100, base: 0, rate: 0.18 },
        { from: 237100, to: 370500, base: 42678, rate: 0.26 },
        { from: 370500, to: 512800, base: 77362, rate: 0.31 },
        { from: 512800, to: 673000, base: 121475, rate: 0.36 },
        { from: 673000, to: 857900, base: 179147, rate: 0.39 },
        { from: 857900, to: 1817000, base: 251258, rate: 0.41 },
        { from: 1817000, to: Infinity, base: 644489, rate: 0.45 }
    ]),
    // Rebates are cumulative: someone aged 75+ receives all three
    rebates: Object.freeze({
        [AGE_GROUPS.UNDER_65]: 17235,
        [AGE_GROUPS.AGE_65_TO_74]: 17235 + 9444,
        [AGE_GROUPS.AGE_75_PLUS]: 17235 + 9444 + 3145
    }),
    // Income at or below the threshold attracts no tax (the rebate cancels the tax out)
    thresholds: Object.freeze({
        [AGE_GROUPS.UNDER_65]: 95750,
        [AGE_GROUPS.AGE_65_TO_74]: 148217,
        [AGE_GROUPS.AGE_75_PLUS]: 165689
    })
});

const REBATES = new Map(Object.entries(TAX_TABLE.rebates));
const THRESHOLDS = new Map(Object.entries(TAX_TABLE.thresholds));

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// The tax year containing `date`: 1 March of one year to 28/29 February of the next.
// Dates are built in UTC so the boundaries do not shift with the server timezone.
const getTaxYear = (date = new Date()) => {
    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const startYear = month >= TAX_TABLE.startMonth ? year : year - 1;

    return {
        label: `${startYear}/${startYear + 1}`,
        tableLabel: TAX_TABLE.label,
        start: new Date(Date.UTC(startYear, TAX_TABLE.startMonth, 1, 0, 0, 0, 0)),
        // Exclusive: the first instant of the next tax year
        end: new Date(Date.UTC(startYear + 1, TAX_TABLE.startMonth, 1, 0, 0, 0, 0))
    };
};

// The bracket a given taxable income falls into
const findBracket = (taxableIncome) =>
    TAX_TABLE.brackets.find(b => taxableIncome > b.from && taxableIncome <= b.to)
    || TAX_TABLE.brackets[0];

// Per-bracket split of the income, so the frontend can show where the tax comes from
const splitIntoBands = (taxableIncome) =>
    TAX_TABLE.brackets
        .map((bracket) => {
            const incomeInBand = Math.max(0, Math.min(taxableIncome, bracket.to) - bracket.from);
            return {
                from: bracket.from,
                to: bracket.to === Infinity ? null : bracket.to,
                rate: round2(bracket.rate * 100),
                incomeInBand: round2(incomeInBand),
                taxInBand: round2(incomeInBand * bracket.rate)
            };
        })
        .filter((band) => band.from === 0 || band.incomeInBand > 0);

/**
 * Estimates annual income tax from gross income.
 *
 * @param {object} options
 * @param {number} options.grossIncome Income earned in the tax year, in rands.
 * @param {number} [options.expenses]  Deductible business expenses, in rands.
 * @param {string} [options.ageGroup]  One of AGE_GROUPS; defaults to under 65.
 * @returns {object} A full breakdown. All amounts are rands, all rates percentages.
 */
const estimateTax = ({ grossIncome, expenses = 0, ageGroup = AGE_GROUPS.UNDER_65 } = {}) => {
    const group = Object.values(AGE_GROUPS).includes(ageGroup) ? ageGroup : AGE_GROUPS.UNDER_65;

    const safeIncome = Number.isFinite(Number(grossIncome)) ? Math.max(0, Number(grossIncome)) : 0;
    const safeExpenses = Number.isFinite(Number(expenses)) ? Math.max(0, Number(expenses)) : 0;

    // Step 1: expenses can reduce income to zero but never below it
    const deductedExpenses = Math.min(safeExpenses, safeIncome);
    const taxableIncome = safeIncome - deductedExpenses;

    const bracket = findBracket(taxableIncome);
    // Map lookups rather than computed property access: there is no way for a
    // key to reach the object prototype, whatever `group` contains.
    const rebate = REBATES.get(group);
    const threshold = THRESHOLDS.get(group);

    // Step 2: cumulative base for the bracket plus the marginal slice above its lower edge
    const grossTax = taxableIncome === 0 ? 0 : bracket.base + ((taxableIncome - bracket.from) * bracket.rate);
    // Step 3: the rebate is a credit against tax owed and can never create a refund
    const taxPayable = Math.max(0, grossTax - rebate);
    const netIncome = taxableIncome - taxPayable;

    return {
        grossIncome: round2(safeIncome),
        expenses: round2(deductedExpenses),
        taxableIncome: round2(taxableIncome),
        grossTax: round2(grossTax),
        rebate,
        taxPayable: round2(taxPayable),
        netIncome: round2(netIncome),
        // Step 4: effective is what is paid overall, marginal is the rate on the next rand
        effectiveRate: taxableIncome > 0 ? round2((taxPayable / taxableIncome) * 100) : 0,
        marginalRate: taxPayable > 0 ? round2(bracket.rate * 100) : 0,
        threshold,
        belowThreshold: taxPayable === 0,
        // Step 5: provisional taxpayers pay in two instalments
        provisionalPayment: round2(taxPayable / 2),
        ageGroup: group,
        bands: splitIntoBands(taxableIncome)
    };
};

module.exports = { estimateTax, getTaxYear, AGE_GROUPS, TAX_TABLE };
