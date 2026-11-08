const dns = require('dns');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// Wrap any $-operators supplied in query filters with $eq (defence against NoSQL injection)
mongoose.set('sanitizeFilter', true);
// Ignore query fields that are not defined in the schema
mongoose.set('strictQuery', true);

const connectDB = async (uri) => {
    // mongodb+srv:// URIs need a DNS SRV lookup, which some routers/ISPs/VPNs refuse
    // (querySrv ECONNREFUSED). Use public resolvers for that lookup only; plain
    // mongodb:// URIs (e.g. the Docker Compose database) use normal name resolution.
    if (uri.startsWith('mongodb+srv://')) {
        const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim());
        dns.setServers(servers);
    }

    await mongoose.connect(uri);
    logger.info('db.connected', { category: 'system', host: mongoose.connection.host, database: mongoose.connection.name });

    // Surface connection problems after start-up (e.g. database restarts)
    mongoose.connection.on('disconnected', () => logger.warn('db.disconnected', { category: 'system' }));
    mongoose.connection.on('reconnected', () => logger.info('db.reconnected', { category: 'system' }));
};

module.exports = connectDB;
