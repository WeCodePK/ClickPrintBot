'use strict';

function trimTrailingSlash(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

const config = {
  apiUrl: trimTrailingSlash(process.env.BACKEND_URL) || 'http://backend:3000',
  serviceKey: process.env.SERVICE_KEY,

  verifyToken: process.env.VERIFY_TOKEN,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  wabaPhoneNumberId: process.env.WABA_PHONE_NUMBER_ID,
  graphApiVersion: process.env.GRAPH_API_VERSION || 'v21.0',
  graphApiBaseUrl: trimTrailingSlash(process.env.GRAPH_API_BASE_URL) || 'https://graph.facebook.com',

  port: Number.parseInt(process.env.PORT, 10) || 3000,

  // How long a pending free-text prompt (e.g. "reply with your new name") stays
  // valid before it's treated as stale and dropped.
  pendingInputTtlMs: 15 * 60 * 1000,
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

// Cloud API image messages carry no filename; documents do. Used to
// synthesize one for images/other media on upload.
config.extensionByMimeType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

module.exports = config;
