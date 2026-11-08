import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GigsPage from '../pages/GigsPage';
import { CLIENT, FREELANCER, jsonResponse, loginAs, mockFetch, renderWithProviders } from '../test/utils';

const gigs = [
    { _id: 'g1', title: 'Professional Logo Design', description: 'Logos', category: 'Design', price: 1500, deliveryDays: 5, freelancer: { username: 'sipho' } },
    { _id: 'g2', title: 'React Website Build', description: 'Websites', category: 'Development', price: 5000, deliveryDays: 14, freelancer: { username: 'lerato' } }
];

describe('GigsPage', () => {
    it('loads and displays available gigs', async () => {
        loginAs(CLIENT);
        const fetchMock = mockFetch(jsonResponse(200, { count: 2, gigs }));
        renderWithProviders(<GigsPage />);

        expect(await screen.findByText('Professional Logo Design')).toBeInTheDocument();
        expect(screen.getByText('React Website Build')).toBeInTheDocument();
        expect(fetchMock.mock.calls[0][0]).toBe('/api/gigs');
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer /);
    });

    it('searches by keyword and category', async () => {
        loginAs(CLIENT);
        const fetchMock = mockFetch(
            jsonResponse(200, { count: 2, gigs }),
            jsonResponse(200, { count: 1, gigs: [gigs[0]] })
        );
        renderWithProviders(<GigsPage />);
        await screen.findByText('React Website Build');

        await userEvent.type(screen.getByLabelText('Search gigs'), 'logo');
        await userEvent.selectOptions(screen.getByLabelText('Category'), 'Design');
        await userEvent.click(screen.getByRole('button', { name: 'Search' }));

        expect(fetchMock.mock.calls[1][0]).toBe('/api/gigs?search=logo&category=Design');
        expect(await screen.findByText('Professional Logo Design')).toBeInTheDocument();
        expect(screen.queryByText('React Website Build')).not.toBeInTheDocument();
    });

    it('shows an empty state when there are no gigs', async () => {
        loginAs(CLIENT);
        mockFetch(jsonResponse(200, { count: 0, gigs: [] }));
        renderWithProviders(<GigsPage />);
        expect(await screen.findByText('No gigs found.')).toBeInTheDocument();
    });

    it('shows a generic message instead of server error details', async () => {
        loginAs(CLIENT);
        mockFetch(jsonResponse(500, { message: 'MongoServerError: connection refused at db.js:12' }));
        renderWithProviders(<GigsPage />);

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Something went wrong. Please try again later.');
        expect(alert).not.toHaveTextContent(/mongo/i);
    });

    it('only shows the "Create a gig" button to freelancers', async () => {
        loginAs(CLIENT);
        mockFetch(jsonResponse(200, { count: 0, gigs: [] }));
        const { unmount } = renderWithProviders(<GigsPage />);
        await screen.findByText('No gigs found.');
        expect(screen.queryByRole('link', { name: 'Create a gig' })).not.toBeInTheDocument();
        unmount();

        loginAs(FREELANCER);
        mockFetch(jsonResponse(200, { count: 0, gigs: [] }));
        renderWithProviders(<GigsPage />);
        await screen.findByText('No gigs found.');
        expect(screen.getByRole('link', { name: 'Create a gig' })).toBeInTheDocument();
    });
});
