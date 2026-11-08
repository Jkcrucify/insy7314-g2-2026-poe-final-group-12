const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const gigRoutes = require('./routes/gigRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const transactionRoutes = require('./routes/transactionRoutes');

const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeInput } = require('./middleware/sanitizeMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { requestLogger } = require('./middleware/requestLogger');

const app = express();

// Behind the nginx reverse proxy (Docker) the client IP arrives in X-Forwarded-For.
// Trusting one proxy hop keeps per-IP rate limiting and logging accurate.
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Request ID + access log for every request (registered first so it also covers rejected requests)
app.use(requestLogger);

// Security headers, including a strict Content Security Policy.
// The API only ever returns JSON, so nothing may be loaded, framed or submitted.
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'none'"]
        }
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true }
}));

// Only the React frontend may call the API from a browser
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Responses contain personal data, so prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

app.use(express.json({ limit: '10kb' })); // Parses JSON payloads and rejects oversized bodies
app.use(sanitizeInput); // Strips XSS payloads and NoSQL operators from the body
app.use('/api', apiLimiter);

// Basic Test Route
app.get('/api/status', (req, res) => {
    res.status(200).json({ message: 'Secure HustleHub+ API is running!' });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/transactions', transactionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
