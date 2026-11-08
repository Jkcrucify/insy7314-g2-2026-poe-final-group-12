// Thin wrapper around fetch that attaches the JWT and normalises errors.
// Server error details are never shown to the user; 5xx responses get a generic message.

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken = null;
let unauthorizedHandler = null;

export const setAuthToken = (token) => {
    authToken = token;
};

export const setUnauthorizedHandler = (handler) => {
    unauthorizedHandler = handler;
};

export class ApiError extends Error {
    constructor(message, status, errors = []) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.errors = errors; // [{ field, message }] from server-side validation
    }
}

const request = async (path, { method = 'GET', body } = {}) => {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch {
        throw new ApiError('Unable to reach the server. Please try again later.', 0);
    }

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        // An authenticated request was rejected: the session has expired or the token is invalid
        if (response.status === 401 && authToken && unauthorizedHandler) {
            unauthorizedHandler();
        }
        const message = response.status >= 500
            ? 'Something went wrong. Please try again later.'
            : (data && typeof data.message === 'string' ? data.message : 'Request failed.');
        const errors = data && Array.isArray(data.errors) ? data.errors : [];
        throw new ApiError(message, response.status, errors);
    }

    return data;
};

export const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' })
};
