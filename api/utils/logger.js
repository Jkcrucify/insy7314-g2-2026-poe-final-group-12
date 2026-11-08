const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Central structured logger.
// app.log      - every event (JSON, one per line)
// security.log - security events only (auth, access control, rate limits, injection attempts)
// error.log    - errors only
// Files rotate at 5 MB and the last 5 are kept.
// When LOKI_HOST / LOKI_USER / LOKI_TOKEN are set, every event is also shipped to
// Grafana Cloud Loki for central search, dashboards and alerting.

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
// Safe: the path comes from deployment configuration, never from a request.
// eslint-disable-next-line security/detect-non-literal-fs-filename
fs.mkdirSync(LOG_DIR, { recursive: true });

// Values under these keys are never written to a log
const SENSITIVE_KEYS = new Set(['password', 'token', 'authorization', 'jwt', 'secret', 'cookie']);

// Log metadata can contain user-supplied field names. Copying one of these onto
// a fresh object with bracket notation would reach Object.prototype, so they are
// dropped while redacting rather than copied through.
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const redact = (value, depth = 0) => {
    if (depth > 5) return '[Truncated]';
    if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            if (PROTOTYPE_KEYS.has(key)) continue;
            // Safe: `key` is checked against the deny list above and `result` is a
            // fresh object literal.
            // eslint-disable-next-line security/detect-object-injection
            result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
        }
        return result;
    }
    return value;
};

const redactFormat = winston.format((info) => {
    for (const key of Object.keys(info)) {
        /* eslint-disable security/detect-object-injection --
           `key` comes from Object.keys(info), so it is an own property of the
           log record itself; no value is used as a lookup into another object. */
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
            info[key] = '[REDACTED]';
        } else if (info[key] && typeof info[key] === 'object') {
            info[key] = redact(info[key]);
        }
        /* eslint-enable security/detect-object-injection */
    }
    return info;
});

const onlySecurity = winston.format((info) => (info.category === 'security' ? info : false));

// JSON output escapes newlines and quotes, so user input cannot forge extra log lines
const jsonFormat = winston.format.combine(redactFormat(), winston.format.timestamp(), winston.format.json());

const consoleFormat = process.env.NODE_ENV === 'production'
    ? jsonFormat
    : winston.format.combine(
        redactFormat(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
            const details = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level} [${category || 'app'}] ${message}${details}`;
        })
    );

const fileOptions = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: jsonFormat,
    defaultMeta: { service: 'hustlehub-api' },
    transports: [
        new winston.transports.Console({ format: consoleFormat }),
        new winston.transports.File({ filename: path.join(LOG_DIR, 'app.log'), ...fileOptions }),
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'security.log'),
            format: winston.format.combine(onlySecurity(), jsonFormat),
            ...fileOptions
        }),
        new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error', ...fileOptions })
    ]
});

// Optional cloud logging: Grafana Cloud Loki. Logs are batched every 5 seconds and the
// same redacted JSON line written to the files is sent, so no secrets leave the server.
const { LOKI_HOST, LOKI_USER, LOKI_TOKEN } = process.env;
if (LOKI_HOST && LOKI_USER && LOKI_TOKEN) {
    const LokiTransport = require('winston-loki');
    logger.add(new LokiTransport({
        // The transport appends /loki/api/v1/push itself, so accept the full push URL too
        host: LOKI_HOST.replace(/\/loki\/api\/v1\/push\/?$/, '').replace(/\/$/, ''),
        basicAuth: `${LOKI_USER}:${LOKI_TOKEN}`,
        labels: { app: 'hustlehub', service: 'hustlehub-api', environment: process.env.NODE_ENV || 'development' },
        format: jsonFormat,
        json: true,
        batching: true,
        interval: 5,
        replaceTimestamp: true,
        timeout: 10000,
        // A Loki outage must never break the API; report it locally instead
        onConnectionError: (error) => process.stderr.write(`Loki logging error: ${error.message}\n`)
    }));
}

// Masks an email so logs can correlate attempts without storing the full address: t***@test.com
const maskEmail = (email) => {
    if (typeof email !== 'string' || !email.includes('@')) return undefined;
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}***@${domain}`;
};

// Who/where a request came from, attached to every event
const requestContext = (req) => ({
    requestId: req.id,
    ip: req.ip,
    userId: req.user?.id,
    role: req.user?.role,
    method: req.method,
    path: req.originalUrl?.split('?')[0]
});

// Business events: bookings, transactions, gig changes, registrations
const logEvent = (req, event, details = {}, level = 'info') =>
    logger.log(level, event, { ...requestContext(req), ...details, category: 'app' });

// Security events: logins, rejected tokens, access denied, rate limits, injection attempts
const logSecurity = (req, event, details = {}, level = 'warn') =>
    logger.log(level, event, { ...requestContext(req), ...details, category: 'security' });

module.exports = { logger, logEvent, logSecurity, maskEmail, LOG_DIR };
