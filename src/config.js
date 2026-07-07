'use strict';

require('dotenv').config();

function trimTrailingSlash(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

const config = {
  apiUrl: trimTrailingSlash(process.env.CLICKPRINT_API_URL) || 'https://clickprintbackend.wckd.pk',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  tokenTtlSeconds: Number.parseInt(process.env.TOKEN_TTL_SECONDS, 10) || 60 * 60 * 24 * 30,
  wwebjsClientId: process.env.WWEBJS_CLIENT_ID || 'clickprint',
  // Where LocalAuth persists the WhatsApp session. In Docker this points at a
  // mounted volume (e.g. /data); left unset it uses the default .wwebjs_auth/.
  wwebjsDataPath: process.env.WWEBJS_DATA_PATH || undefined,
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),

  // How long a listed collection (shops / jobs) stays valid so the user can
  // reference it by its 1-based index (e.g. `/shop 2`, `/cancel 1`).
  listCacheTtlSeconds: 60 * 15,
};

// Default print settings applied to every newly uploaded file.
config.defaultSettings = Object.freeze({
  color: false,
  pageType: 'A4',
  pagesPerSheet: 1,
  numberOfCopies: 1,
  sidedness: 'none',
  pageSelection: '',
  orientation: 'portrait',
});

module.exports = config;
