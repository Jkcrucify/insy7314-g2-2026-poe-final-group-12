import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Navbar from '../components/Navbar';
import { CLIENT, FREELANCER, jsonResponse, loginAs, mockFetch, renderWithProviders } from '../test/utils';

describe('Navbar', () => {
    it('shows login and sign up links when logged out', () => {
        renderWithProviders(<Navbar />);
        expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
    });

    it('shows client links without the freelancer dashboard', () => {
        loginAs(CLIENT);
        renderWithProviders(<Navbar />);
        expect(screen.getByRole('link', { name: 'My bookings' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
        expect(screen.getByText('thandi')).toBeInTheDocument();
    });

    it('shows the dashboard and income links to freelancers', () => {
        loginAs(FREELANCER);
        renderWithProviders(<Navbar />);
        expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Income & tax' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Bookings received' })).toBeInTheDocument();
    });

    it('hides the income link from clients', () => {
        loginAs(CLIENT);
        renderWithProviders(<Navbar />);
        expect(screen.queryByRole('link', { name: 'Income & tax' })).not.toBeInTheDocument();
    });

    it('clears the session when the user logs out', async () => {
        loginAs(CLIENT);
        mockFetch(jsonResponse(200, { message: 'Logged out.' }));
        renderWithProviders(<Navbar />);
        await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

        expect(sessionStorage.getItem('hh_token')).toBeNull();
        expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    });

    it('asks the API to revoke the token when logging out', async () => {
        loginAs(CLIENT);
        const fetchMock = mockFetch(jsonResponse(200, { message: 'Logged out.' }));
        renderWithProviders(<Navbar />);
        await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toContain('/auth/logout');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toMatch(/^Bearer /);
    });
});
