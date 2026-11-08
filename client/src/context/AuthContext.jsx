import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';
import { getTokenExpiry } from '../utils/format';

const TOKEN_KEY = 'hh_token';
const USER_KEY = 'hh_user';

const AuthContext = createContext(null);

// sessionStorage is cleared when the tab closes, limiting how long a token lives in the browser
const readStoredSession = () => {
    try {
        const token = sessionStorage.getItem(TOKEN_KEY);
        const user = JSON.parse(sessionStorage.getItem(USER_KEY));
        const expiry = token ? getTokenExpiry(token) : null;
        if (token && user && expiry && expiry > Date.now()) {
            return { token, user };
        }
    } catch {
        // Corrupt storage is treated as logged out
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return { token: null, user: null };
};

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(readStoredSession);
    const [sessionExpired, setSessionExpired] = useState(false);

    // Keep the API client's token in sync before children make requests
    setAuthToken(session.token);

    // Clears the browser session. `revoke` additionally asks the API to blocklist the
    // token so a copy taken from storage cannot be replayed before it expires.
    const logout = useCallback((expired = false, revoke = true) => {
        if (revoke && !expired) {
            // Fire and forget: a failed revoke must never trap the user in a logged-in state
            api.post('/auth/logout').catch(() => {});
        }
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        setAuthToken(null);
        setSessionExpired(expired);
        setSession({ token: null, user: null });
    }, []);

    const login = useCallback(async (email, password) => {
        const data = await api.post('/auth/login', { email: email.trim(), password });
        sessionStorage.setItem(TOKEN_KEY, data.token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setAuthToken(data.token);
        setSessionExpired(false);
        setSession({ token: data.token, user: data.user });
        return data.user;
    }, []);

    const register = useCallback(
        (details) => api.post('/auth/register', details),
        []
    );

    // Log out automatically if the API rejects the token
    useEffect(() => {
        setUnauthorizedHandler(() => logout(true));
        return () => setUnauthorizedHandler(null);
    }, [logout]);

    // Log out automatically when the token expires
    useEffect(() => {
        if (!session.token) return undefined;
        const expiry = getTokenExpiry(session.token);
        const timer = setTimeout(() => logout(true), Math.max(0, expiry - Date.now()));
        return () => clearTimeout(timer);
    }, [session.token, logout]);

    const value = useMemo(() => ({
        user: session.user,
        isAuthenticated: Boolean(session.token),
        sessionExpired,
        login,
        logout,
        register
    }), [session, sessionExpired, login, logout, register]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside an AuthProvider');
    return context;
};
