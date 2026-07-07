'use strict';

const Redis = require('ioredis');
const config = require('./config');
const logger = require('./logger');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err.message));

module.exports = redis;
