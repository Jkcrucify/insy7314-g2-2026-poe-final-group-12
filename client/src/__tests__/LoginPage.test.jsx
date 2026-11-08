import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../pages/LoginPage';
import { CLIENT, jsonResponse, makeToken, mockFetch, renderWithProviders } from '../test/utils';

const renderLogin = () =>
    renderWithProviders(<LoginPage />, {
        route: '/login',
        path: '/login',
        extraRoutes: { '/gigs': <h1>Gigs page</h1> }
    });

describe('LoginPage', () => {
    it('renders the email and password fields and a submit button', () => {
        renderLogin();
        expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
    });

    it('shows validation errors and does not call the API when fields are empty', async () => {
        const fetchMock = mockFetch();
        renderLogin();

        await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

        expect(screen.getByText('Email is required.')).toBeInTheDocument();
        expect(screen.getByText('Password is required.')).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid email format', async () => {
        renderLogin();
        await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
        await userEvent.type(screen.getByLabelText('Password'), 'whatever');
        await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

        expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    });

    it('logs the user in, stores the session and redirects to the gigs page', async () => {
        const fetchMock = mockFetch(jsonResponse(200, {
            token: makeToken({ id: CLIENT.id, role: CLIENT.role }),
            user: CLIENT
        }));
        renderLogin();

        await userEvent.type(screen.getByLabelText('Email'), 'thandi@test.com');
        await userEvent.type(screen.getByLabelText('Password'), 'Str0ng!Pass');
        await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

        expect(await screen.findByRole('heading', { name: 'Gigs page' })).toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/auth/login');
        expect(options.method).toBe('POST');
        expect(JSON.parse(options.body)).toEqual({ email: 'thandi@test.com', password: 'Str0ng!Pass' });
        expect(sessionStorage.getItem('hh_token')).toBeTruthy();
    });

    it('shows a generic error and clears the password when credentials are wrong', async () => {
        mockFetch(jsonResponse(401, { message: 'Invalid credentials.' }));
        renderLogin();

        await userEvent.type(screen.getByLabelText('Email'), 'thandi@test.com');
        await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1!');
        await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
        expect(screen.getByLabelText('Password')).toHaveValue('');
        expect(sessionStorage.getItem('hh_token')).toBeNull();
    });

    it('shows the rate-limit message when too many attempts are made', async () => {
        mockFetch(jsonResponse(429, { message: 'Too many authentication attempts. Please try again in 15 minutes.' }));
        renderLogin();

        await userEvent.type(screen.getByLabelText('Email'), 'thandi@test.com');
        await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1!');
        await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/too many authentication attempts/i);
    });
});
