const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Starts a single-node replica set. Mongoose transactions (used when a booking
// and its transaction record are written atomically) are only available on a
// replica set, so a standalone in-memory server is not enough.
module.exports = async () => {
    const replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' }
    });

    process.env.MONGO_URI = replSet.getUri('hustlehub_test');
    globalThis.__MONGO_REPLSET__ = replSet;
};
