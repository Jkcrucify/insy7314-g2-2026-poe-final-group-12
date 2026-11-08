import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IncomePage from '../pages/IncomePage';
import { FREELANCER, jsonResponse, loginAs, mockFetch, renderWithProviders } from '../test/utils';
import { formatCurrency } from '../utils/format';

// The app formats rands with non-breaking spaces, so expectations are built with
// the same formatter the component uses rather than hard-coded strings.
const money = (amount) => formatCurrency(amount).replace(/\u00a0/g, ' ');

const MONTH_LABELS = ['Mar 25', 'Apr 25', 'May 25', 'Jun 25', 'Jul 25', 'Aug 25',
    'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25', 'Jan 26', 'Feb 26'];

// Mirrors the shape the API returns. The figures are the real SARS result for
// R150 000 of income: R150 000 x 18% = R27 000, less the R17 235 rebate.
const incomeSummary = (overrides = {}) => ({
    freelancer: 'sipho',
    currency: 'ZAR',
    totalIncome: 180000,
    transactionCount: 4,
    taxYear: {
        label: '2025/2026',
        tableLabel: '2025/2026',
        start: '2025-03-01T00:00:00.000Z',
        end: '2026-03-01T00:00:00.000Z',
        income: 150000,
        transactionCount: 3
    },
    monthly: MONTH_LABELS.map((label, index) => ({
        key: `m${index}`,
        label,
        income: index === 1 ? 100000 : (index === 4 ? 50000 : 0),
        transactions: index === 1 ? 2 : (index === 4 ? 1 : 0)
    })),
    topGigs: [
        { title: 'Logo design', income: 100000, count: 2 },
        { title: 'Brand guide', income: 50000, count: 1 }
    ],
    tax: {
        grossIncome: 150000,
        expenses: 0,
        taxableIncome: 150000,
        grossTax: 27000,
        rebate: 17235,
        taxPayable: 9765,
        netIncome: 140235,
        effectiveRate: 6.51,
        marginalRate: 18,
        threshold: 95750,
        belowThreshold: false,
        provisionalPayment: 4882.5,
        ageGroup: 'under65',
        bands: [
            { from: 0, to: 237100, rate: 18, incomeInBand: 150000, taxInBand: 27000 }
        ]
    },
    ...overrides
});

// Scopes a query to one stat tile, so the same amount appearing elsewhere on the
// page (in the explanation or the bracket table) cannot satisfy the assertion.
const tile = (label) => screen.getAllByText(label).map(el => el.closest('.stat')).find(Boolean);

const renderIncomePage = (...responses) => {
    loginAs(FREELANCER);
    const fetchMock = mockFetch(...responses);
    renderWithProviders(<IncomePage />, { route: '/income', path: '/income' });
    return fetchMock;
};

describe('IncomePage', () => {
    it('shows the income, tax, take-home and marginal rate for the tax year', async () => {
        renderIncomePage(jsonResponse(200, incomeSummary()));

        await screen.findByText('Income & tax');

        expect(within(tile('Income this tax year')).getByText(money(150000))).toBeInTheDocument();
        expect(within(tile('Estimated tax')).getByText(money(9765))).toBeInTheDocument();
        expect(within(tile('Estimated take-home')).getByText(money(140235))).toBeInTheDocument();
        expect(within(tile('Marginal rate')).getByText('18%')).toBeInTheDocument();
        expect(within(tile('Estimated tax')).getByText(/6\.51%\s*effective rate/)).toBeInTheDocument();
    });

    it('explains how the estimate was worked out', async () => {
        renderIncomePage(jsonResponse(200, incomeSummary()));

        expect(await screen.findByText('How this is worked out')).toBeInTheDocument();
        expect(screen.getByText(/minus expenses/)).toBeInTheDocument();
        expect(screen.getByText(/Less the rebate/)).toBeInTheDocument();
        expect(screen.getByText(/is therefore tax free/)).toBeInTheDocument();
        expect(screen.getByText(/estimate for planning only/i)).toBeInTheDocument();
    });

    it('charts income by month and offers the same figures as a table', async () => {
        renderIncomePage(jsonResponse(200, incomeSummary()));

        const chart = await screen.findByRole('img', { name: /Monthly income for the 2025\/2026 tax year/ });
        expect(chart).toBeInTheDocument();

        // The accessible table fallback carries every month, including empty ones
        await userEvent.click(screen.getByText('Show the data as a table'));
        const table = screen.getByRole('table', { name: /Monthly income/ });
        expect(within(table).getAllByRole('row')).toHaveLength(13); // 12 months + header
        expect(within(table).getByRole('rowheader', { name: 'Apr 25' })).toBeInTheDocument();
    });

    it('lists the tax brackets that were applied', async () => {
        renderIncomePage(jsonResponse(200, incomeSummary()));

        const table = await screen.findByRole('table', { name: /tax brackets/i });
        expect(within(table).getByText(`${money(0)} – ${money(237100)}`)).toBeInTheDocument();
        expect(within(table).getByText('Gross tax before rebate')).toBeInTheDocument();
        expect(within(table).getByText(`-${money(17235)}`)).toBeInTheDocument();
    });

    it('ranks the top earning gigs', async () => {
        renderIncomePage(jsonResponse(200, incomeSummary()));

        expect(await screen.findByRole('rowheader', { name: 'Logo design' })).toBeInTheDocument();
        expect(screen.getByRole('rowheader', { name: 'Brand guide' })).toBeInTheDocument();
    });

    it('recalculates with the expenses and age group supplied', async () => {
        const reduced = incomeSummary();
        reduced.tax = { ...reduced.tax, expenses: 50000, taxableIncome: 100000, taxPayable: 765, netIncome: 99235 };

        const fetchMock = renderIncomePage(
            jsonResponse(200, incomeSummary()),
            jsonResponse(200, reduced)
        );

        await screen.findByText('Income & tax');
        expect(within(tile('Estimated tax')).getByText(money(9765))).toBeInTheDocument();

        const expenses = screen.getByLabelText(/Deductible business expenses/);
        await userEvent.clear(expenses);
        await userEvent.type(expenses, '50000');
        await userEvent.selectOptions(screen.getByLabelText('Age group'), '75plus');
        await userEvent.click(screen.getByRole('button', { name: 'Recalculate' }));

        await waitFor(() => expect(within(tile('Estimated tax')).getByText(money(765))).toBeInTheDocument());

        const lastUrl = fetchMock.mock.calls.at(-1)[0];
        expect(lastUrl).toContain('expenses=50000');
        expect(lastUrl).toContain('ageGroup=75plus');
    });

    it('tells a freelancer under the threshold that no tax is due', async () => {
        const noTax = incomeSummary();
        noTax.taxYear.income = 40000;
        noTax.tax = {
            ...noTax.tax,
            grossIncome: 40000,
            taxableIncome: 40000,
            grossTax: 7200,
            taxPayable: 0,
            netIncome: 40000,
            effectiveRate: 0,
            marginalRate: 0,
            belowThreshold: true,
            provisionalPayment: 0,
            bands: [{ from: 0, to: 237100, rate: 18, incomeInBand: 40000, taxInBand: 7200 }]
        };
        renderIncomePage(jsonResponse(200, noTax));

        await screen.findByText('Income & tax');
        expect(within(tile('Estimated tax')).getByText(`Below the ${money(95750)} threshold`)).toBeInTheDocument();
    });

    it('shows the error message when the API rejects the request', async () => {
        renderIncomePage(jsonResponse(403, { message: 'Forbidden: you do not have permission to perform this action.' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/do not have permission/);
    });
});
