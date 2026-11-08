import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';

// Builds an unsigned JWT-shaped token; only the payload is read by the frontend
export const makeToken = (payload = {}) => {
    const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...payload }));
    return `header.${body}.signature`;
};

export const CLIENT = { id: 'client1', username: 'thandi', email: 'thandi@test.com', role: 'Client' };
export const FREELANCER = { id: 'free1', username: 'sipho', email: 'sipho@test.com', role: 'Freelancer' };

// Simulates an existing logged-in session
export const loginAs = (user, tokenPayload = {}) => {
    sessionStorage.setItem('hh_token', makeToken({ id: user.id, role: user.role, ...tokenPayload }));
    sessionStorage.setItem('hh_user', JSON.stringify(user));
};

export const jsonResponse = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
});

export const mockFetch = (...responses) => {
    const fetchMock = vi.fn();
    responses.forEach(r => fetchMock.mockResolvedValueOnce(r));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

// Renders `ui` at `path` inside the router + auth provider, plus any extra routes ({ path: element })
export const renderWithProviders = (ui, { route = '/', path = '*', extraRoutes = {} } = {}) =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <AuthProvider>
                <Routes>
                    <Route path={path} element={ui} />
                    {Object.entries(extraRoutes).map(([p, element]) => (
                        <Route key={p} path={p} element={element} />
                    ))}
                </Routes>
            </AuthProvider>
        </MemoryRouter>
    );
