import { screen, within } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage';
import { FREELANCER, jsonResponse, loginAs, mockFetch, renderWithProviders } from '../test/utils';
import { formatCurrency } from '../utils/format';

const money = (amount) => formatCurrency(amount).replace(/\u00a0/g, ' ');
const tile = (label) => screen.getAllByText(label).map(el => el.closest('.stat')).find(Boolean);

const INCOME = {
    freelancer: 'sipho',
    currency: 'ZAR',
    totalIncome: 150000,
    transactionCount: 3,
    taxYear: { label: '2025/2026', tableLabel: '2025/2026', income: 150000, transactionCount: 3 },
    monthly: Array.from({ length: 12 }, (_, i) => ({
        key: `m${i}`,
        label: `M${i}`,
        income: i === 0 ? 150000 : 0,
        transactions: i === 0 ? 3 : 0
    })),
    topGigs: [],
    tax: { taxPayable: 9765, netIncome: 140235, effectiveRate: 6.51, marginalRate: 18 }
};

const GIGS = { gigs: [{ _id: 'g1', title: 'Logo design', category: 'Design', price: 1500, deliveryDays: 3 }] };

const renderDashboard = () => {
    loginAs(FREELANCER);
    mockFetch(jsonResponse(200, INCOME), jsonResponse(200, GIGS));
    renderWithProviders(<DashboardPage />, { route: '/dashboard', path: '/dashboard' });
};

describe('DashboardPage', () => {
    it('shows total income, estimated tax, paid bookings and active gigs', async () => {
        renderDashboard();

        expect(await screen.findByText('Freelancer dashboard')).toBeInTheDocument();
        expect(within(tile('Total income')).getByText(money(150000))).toBeInTheDocument();
        expect(within(tile('Estimated tax')).getByText(money(9765))).toBeInTheDocument();
        expect(within(tile('Estimated tax')).getByText('2025/2026 tax year')).toBeInTheDocument();
        expect(within(tile('Paid bookings')).getByText('3')).toBeInTheDocument();
        expect(within(tile('Active gigs')).getByText('1')).toBeInTheDocument();
    });

    it('charts the income earned in the tax year', async () => {
        renderDashboard();

        expect(await screen.findByRole('img', { name: /Monthly income for the 2025\/2026 tax year/ }))
            .toBeInTheDocument();
    });

    it('links through to the full income and tax breakdown', async () => {
        renderDashboard();

        const links = await screen.findAllByRole('link', { name: /income/i });
        expect(links.some(link => link.getAttribute('href') === '/income')).toBe(true);
    });

    it('lists the freelancer\'s own gigs', async () => {
        renderDashboard();

        expect(await screen.findByRole('link', { name: 'Logo design' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
});
