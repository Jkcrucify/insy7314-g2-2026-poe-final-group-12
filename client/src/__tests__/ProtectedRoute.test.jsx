import { screen } from '@testing-library/react';
import ProtectedRoute from '../components/ProtectedRoute';
import { CLIENT, FREELANCER, loginAs, renderWithProviders } from '../test/utils';

const renderDashboardRoute = () =>
    renderWithProviders(
        <ProtectedRoute roles={['Freelancer']}><p>Secret dashboard</p></ProtectedRoute>,
        { route: '/dashboard', path: '/dashboard', extraRoutes: { '/login': <p>Login screen</p> } }
    );

describe('ProtectedRoute', () => {
    it('redirects unauthenticated users to the login page', () => {
        renderDashboardRoute();
        expect(screen.getByText('Login screen')).toBeInTheDocument();
        expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
    });

    it('treats an expired token as logged out', () => {
        loginAs(FREELANCER, { exp: Math.floor(Date.now() / 1000) - 60 });
        renderDashboardRoute();
        expect(screen.getByText('Login screen')).toBeInTheDocument();
        expect(sessionStorage.getItem('hh_token')).toBeNull();
    });

    it('blocks users whose role is not allowed', () => {
        loginAs(CLIENT);
        renderDashboardRoute();
        expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
        expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
    });

    it('renders the page for users with an allowed role', () => {
        loginAs(FREELANCER);
        renderDashboardRoute();
        expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
    });
});
