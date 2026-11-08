import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The HTTPS API runs with a self-signed certificate on port 5001
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'https://localhost:5001';

// Content Security Policy for the frontend.
// The dev server needs inline scripts/styles for hot reloading; the production build does not.
const contentSecurityPolicy = (dev) => [
    "default-src 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws://localhost:5173' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
].join('; ');

const securityHeaders = (dev) => ({
    'Content-Security-Policy': contentSecurityPolicy(dev),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
});

// Requests to /api are forwarded to the backend, so the browser only ever talks to one origin
const apiProxy = {
    '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false // Accept the local self-signed certificate (development only)
    }
};

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        headers: securityHeaders(true),
        proxy: apiProxy
    },
    preview: {
        port: 4173,
        strictPort: true,
        headers: securityHeaders(false),
        proxy: apiProxy
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.js',
        css: false
    }
});
