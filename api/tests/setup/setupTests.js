const mongoose = require('mongoose');

// Test configuration is set before any application module is required, because
// the rate limiters and the logger read their options at load time.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-in-production';
process.env.JWT_EXPIRES_IN = '1h';
// IP rate limiting would block the many logins these suites perform. Brute-force
// limiting is covered end to end by the Newman suite against the real stack.
process.env.AUTH_RATE_LIMIT_MAX = '10000';
process.env.BOOKING_RATE_LIMIT_MAX = '10000';
process.env.LOG_DIR = require('path').join(__dirname, '..', '.tmp-logs');

const { logger } = require('../../utils/logger');
logger.silent = true; // Keep the test output readable

// Registering every model up front means their unique and TTL indexes are built
require('../../models/User');
require('../../models/Gig');
require('../../models/Booking');
require('../../models/Transaction');
require('../../models/RevokedToken');

beforeAll(async () => {
    mongoose.set('sanitizeFilter', true);
    mongoose.set('strictQuery', true);
    // Jest runs suites in parallel workers against one replica set. Each worker
    // gets its own database, so one suite clearing its collections can never wipe
    // data another suite is still using.
    await mongoose.connect(process.env.MONGO_URI, {
        dbName: `hustlehub_test_${process.env.JEST_WORKER_ID || '1'}`
    });
    // TTL and unique indexes must exist before the suites rely on them
    await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
});

// Each test starts from an empty database so suites cannot leak state into each other
afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map(collection => collection.deleteMany({})));
});

afterAll(async () => {
    await mongoose.connection.close();
});
