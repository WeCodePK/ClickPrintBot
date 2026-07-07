'use strict';

const axios = require('axios');
const FormData = require('form-data');
const config = require('./config');
const logger = require('./logger');
const redis = require('./redis');

const tokenKey = (number) => `token:${number}`;

/** Error carrying a message safe to show the end user. */
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const http = axios.create({
  baseURL: config.apiUrl,
  timeout: 30000,
  // Let us inspect non-2xx ourselves instead of throwing raw axios errors.
  validateStatus: () => true,
});

function extractMessage(res, fallback) {
  const data = res && res.data;
  if (data && typeof data === 'object' && data.message) return data.message;
  return fallback;
}

/**
 * Fetch (and cache) a forever-token for a user. The backend issues a token
 * per phone number via POST /auth/token { number }, token at data.data.token.
 */
async function fetchNewToken(number) {
  const res = await http.post('/api/auth/token', { number });
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(extractMessage(res, 'Could not authenticate with the backend.'), res.status);
  }
  const token = res.data && res.data.data && res.data.data.token;
  if (!token) throw new ApiError('Backend did not return an auth token.', res.status);
  await redis.set(tokenKey(number), token, 'EX', config.tokenTtlSeconds);
  logger.debug(`Issued new token for ${number}`);
  return token;
}

async function getToken(number, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await redis.get(tokenKey(number));
    if (cached) return cached;
  }
  return fetchNewToken(number);
}

/**
 * Perform an authenticated request. Injects the bearer token and, on a 401,
 * refreshes the token once and retries.
 */
async function authedRequest(number, options, isRetry = false) {
  const token = await getToken(number, isRetry);
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const res = await http.request({ ...options, headers });

  if (res.status === 401 && !isRetry) {
    logger.debug(`401 for ${number}, refreshing token and retrying`);
    return authedRequest(number, options, true);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ApiError(extractMessage(res, `Request failed (${res.status}).`), res.status);
  }
  return res.data;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

async function getProfile(number) {
  const body = await authedRequest(number, { method: 'GET', url: '/api/profile' });
  return body.data.profile;
}

async function updateProfile(number, name) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    url: '/api/profile',
    data: { name },
  });
  return body.data.profile;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function uploadFile(number, buffer, filename, contentType) {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType });
  const body = await authedRequest(number, {
    method: 'POST',
    url: '/api/files',
    data: form,
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return body.data.file;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

async function listShops(number) {
  const body = await authedRequest(number, { method: 'GET', url: '/api/shops' });
  return body.data.shops;
}

async function getShop(number, shopId) {
  const body = await authedRequest(number, { method: 'GET', url: `/api/shops/${shopId}` });
  return body.data.shop;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

async function createDraft(number, payload) {
  const body = await authedRequest(number, { method: 'POST', url: '/api/drafts', data: payload });
  return body.data.draft;
}

async function getDraft(number, draftId) {
  const body = await authedRequest(number, { method: 'GET', url: `/api/drafts/${draftId}` });
  return body.data.draft;
}

async function editDraft(number, draftId, payload) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    url: `/api/drafts/${draftId}`,
    data: payload,
  });
  return body.data.draft;
}

async function deleteDraft(number, draftId) {
  await authedRequest(number, { method: 'DELETE', url: `/api/drafts/${draftId}` });
}

async function checkDraft(number, draftId) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    url: `/api/drafts/${draftId}/check`,
  });
  return body.data.draft;
}

async function submitDraft(number, draftId) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    url: `/api/drafts/${draftId}/submit`,
  });
  return body.data.job;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function listJobs(number) {
  const body = await authedRequest(number, { method: 'GET', url: '/api/jobs' });
  return body.data.jobs;
}

async function updateJobStatus(number, jobId, status) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    url: `/api/jobs/${jobId}/status`,
    data: { status },
  });
  return body.data.job;
}

module.exports = {
  ApiError,
  getToken,
  getProfile,
  updateProfile,
  uploadFile,
  listShops,
  getShop,
  createDraft,
  getDraft,
  editDraft,
  deleteDraft,
  checkDraft,
  submitDraft,
  listJobs,
  updateJobStatus,
};
