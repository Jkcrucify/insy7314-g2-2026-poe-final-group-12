module.exports = {
    testEnvironment: 'node',
    // One in-memory MongoDB replica set is started once and shared by every suite.
    // A replica set (not a standalone server) is required because booking writes
    // the Booking and Transaction documents inside a MongoDB transaction.
    globalSetup: '<rootDir>/tests/setup/globalSetup.js',
    globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
    setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    collectCoverageFrom: [
        'controllers/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'utils/**/*.js',
        'validators/**/*.js'
    ],
    coverageDirectory: 'tests/reports/coverage',
    // Starting the replica set and hashing passwords with 12 bcrypt rounds is slow
    testTimeout: 60000,
    verbose: true
};
