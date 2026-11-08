import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GigDetailPage from '../pages/GigDetailPage';
import { CLIENT, FREELANCER, jsonResponse, loginAs, mockFetch, renderWithProviders } from '../test/utils';

const gig = {
    _id: 'g1',
    title: 'Professional Logo Design',
    description: 'I will design a modern logo for your brand.',
    category: 'Design',
    price: 1500,
    deliveryDays: 5,
    freelancer: { _id: FREELANCER.id, username: FREELANCER.username },
    createdAt: '2026-10-01T10:00:00.000Z'
};

const bookingResponse = {
    message: 'Booking confirmed. Simulated payment successful.',
    booking: { _id: 'b1', status: 'Confirmed', amount: 1500 },
    transaction: { _id: 't1', reference: 'HH-TEST-1234', amount: 1500 }
};

const renderDetail = () => renderWithProviders(<GigDetailPage />, { route: '/gigs/g1', path: '/gigs/:id' });

describe('GigDetailPage booking flow', () => {
    it('requires the client to confirm the simulated payment', async () => {
        loginAs(CLIENT);
        const fetchMock = mockFetch(jsonResponse(200, { gig }));
        renderDetail();

        await screen.findByRole('heading', { name: 'Professional Logo Design' });
        await userEvent.click(screen.getByRole('button', { name: /book/i }));

        expect(screen.getByRole('alert')).toHaveTextContent('Please confirm the simulated payment to continue.');
        expect(fetchMock).toHaveBeenCalledTimes(1); // Only the initial gig load
    });

    it('books the gig and shows the transaction reference', async () => {
        loginAs(CLIENT);
        const fetchMock = mockFetch(jsonResponse(200, { gig }), jsonResponse(201, bookingResponse));
        renderDetail();

        await screen.findByRole('heading', { name: 'Professional Logo Design' });
        await userEvent.type(screen.getByLabelText(/notes for the freelancer/i), 'Blue please');
        await userEvent.click(screen.getByRole('checkbox'));
        await userEvent.click(screen.getByRole('button', { name: /book/i }));

        expect(await screen.findByRole('heading', { name: 'Booking confirmed' })).toBeInTheDocument();
        expect(screen.getByText('HH-TEST-1234')).toBeInTheDocument();

        const [url, options] = fetchMock.mock.calls[1];
        expect(url).toBe('/api/bookings');
        expect(JSON.parse(options.body)).toEqual({ gigId: 'g1', notes: 'Blue please', confirmPayment: true });
    });

    it('does not show the booking form to freelancers', async () => {
        loginAs(FREELANCER);
        mockFetch(jsonResponse(200, { gig }));
        renderDetail();

        await screen.findByRole('heading', { name: 'Professional Logo Design' });
        expect(screen.queryByRole('heading', { name: 'Book this gig' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Edit this gig' })).toBeInTheDocument();
    });
});
