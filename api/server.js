const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables before anything reads them (Docker passes them in directly)
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const app = require('./app');
const { logger } = require('./utils/logger');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5001;
const CERT_DIR = process.env.CERT_DIR || path.join(__dirname, 'certs');

// Fail fast if required configuration is missing
// Safe: the keys are literals in this file, not request data.
// eslint-disable-next-line security/detect-object-injection
const missing = ['JWT_SECRET', 'MONGO_URI'].filter(key => !process.env[key]);
if (missing.length) {
    logger.error('server.config_missing', { category: 'system', variables: missing });
    process.exit(1);
}

// Load SSL Certificates
/* eslint-disable security/detect-non-literal-fs-filename --
   CERT_DIR is deployment configuration read at start-up; no request can reach it. */
const sslOptions = {
    key: fs.readFileSync(path.join(CERT_DIR, 'server.key')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'server.cert'))
};
/* eslint-enable security/detect-non-literal-fs-filename */

const start = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
    } catch (error) {
        logger.error('db.connection_failed', { category: 'system', error: error.message });
        // Give the file transports a moment to flush before exiting
        setTimeout(() => process.exit(1), 200);
        return;
    }

    // Create and start the HTTPS server
    const server = https.createServer(sslOptions, app).listen(PORT, () => {
        logger.info('server.started', { category: 'system', url: `https://localhost:${PORT}`, env: process.env.NODE_ENV || 'development' });
    });

    // Graceful shutdown (docker stop / Ctrl+C): finish in-flight requests, then close the DB connection
    const shutdown = (signal) => {
        logger.info('server.stopping', { category: 'system', signal });
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};

start();
