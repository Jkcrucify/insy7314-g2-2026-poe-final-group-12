// Used by Docker to check the API is up: exits 0 when /api/status returns 200.
// The certificate is self-signed, so verification is skipped for this local check only.
const https = require('https');

const request = https.get(
    { host: 'localhost', port: process.env.PORT || 5001, path: '/api/status', rejectUnauthorized: false, timeout: 4000 },
    (res) => process.exit(res.statusCode === 200 ? 0 : 1)
);
request.on('error', () => process.exit(1));
request.on('timeout', () => { request.destroy(); process.exit(1); });
