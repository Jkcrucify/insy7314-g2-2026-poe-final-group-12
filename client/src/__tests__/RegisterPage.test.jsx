import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../pages/RegisterPage';
import LoginPage from '../pages/LoginPage';
import { jsonResponse, mockFetch, renderWithProviders } from '../test/utils';

const renderRegister = () =>
    renderWithProviders(<RegisterPage />, {
        route: '/register',
        path: '/register',
        extraRoutes: { '/login': <LoginPage /> }
    });

const fillForm = async ({ username, email, password, confirmPassword }) => {
    await userEvent.type(screen.getByLabelText('Username'), username);
    await userEvent.type(screen.getByLabelText('Email'), email);
    await userEvent.type(screen.getByLabelText('Password'), password);
    await userEvent.type(screen.getByLabelText('Confirm password'), confirmPassword);
};

describe('RegisterPage', () => {
    it('renders all registration fields and both account types', () => {
        renderRegister();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /\(client\)/i })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /\(freelancer\)/i })).toBeInTheDocument();
    });

    it('validates weak passwords, mismatched passwords and a missing role', async () => {
        const fetchMock = mockFetch();
        renderRegister();

        await fillForm({ username: 'thandi', email: 'thandi@test.com', password: 'weak', confirmPassword: 'different' });
        await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

        expect(screen.getByText(/password needs/i)).toBeInTheDocument();
        expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
        expect(screen.getByText('Please choose an account type.')).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('registers a freelancer and redirects to login with a success message', async () => {
        const fetchMock = mockFetch(jsonResponse(201, {
            message: 'User registered successfully.',
            user: { id: 'free1', username: 'sipho', role: 'Freelancer' }
        }));
        renderRegister();

        await fillForm({ username: 'sipho', email: 'sipho@test.com', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' });
        await userEvent.click(screen.getByRole('radio', { name: /\(freelancer\)/i }));
        await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

        expect(await screen.findByText('Registration successful. Please log in.')).toBeInTheDocument();
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).toEqual({ username: 'sipho', email: 'sipho@test.com', password: 'Str0ng!Pass', role: 'Freelancer' });
    });

    it('shows a friendly message when the email is already registered', async () => {
        mockFetch(jsonResponse(409, { message: 'User already exists.' }));
        renderRegister();

        await fillForm({ username: 'sipho', email: 'sipho@test.com', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass' });
        await userEvent.click(screen.getByRole('radio', { name: /\(client\)/i }));
        await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists.');
    });
});
