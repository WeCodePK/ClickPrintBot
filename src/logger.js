'use strict';

const config = require('./config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

function log(level, ...args) {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}]`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line, ...args);
}

module.exports = {
  debug: (...a) => log('debug', ...a),
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
};
