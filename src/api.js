'use strict';

const config = require('./config');
const logger = require('./logger');

const REQUEST_TIMEOUT_MS = 30000;

/** Error carrying a message safe to show the end user. */
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Per-number backend session cache (in-memory — see state.js note on why
// there's no Redis here): the bearer token plus the backend user id (needed
// for the /api/users/:userId endpoints). The backend issues a "forever"
// token, so this only needs to be refreshed reactively, on a 401.
const sessionCache = new Map();

function url(path) {
  return `${config.apiUrl}${path}`;
}

async function extractMessage(res, fallback) {
  try {
    const data = await res.clone().json();
    if (data && typeof data === 'object' && data.message) return data.message;
  } catch {
    // non-JSON body, fall through
  }
  return fallback;
}

/** Mint (and cache) a fresh backend session — token + user id — for a phone number. */
async function fetchNewSession(number) {
  const res = await fetch(url('/api/auth/mint'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ApiKey ${config.serviceKey}`,
    },
    body: JSON.stringify({ number }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new ApiError(await extractMessage(res, 'Could not authenticate with the backend.'), res.status);
  }
  const body = await res.json();
  const token = body?.data?.token;
  const userId = body?.data?.user?._id;
  if (!token || !userId) throw new ApiError('Backend did not return an auth token.', res.status);
  const session = { token, userId };
  sessionCache.set(number, session);
  logger.debug(`Issued new session for ${number}`);
  return session;
}

async function getSession(number, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = sessionCache.get(number);
    if (cached) return cached;
  }
  return fetchNewSession(number);
}

async function getToken(number, forceRefresh = false) {
  return (await getSession(number, forceRefresh)).token;
}

async function getUserId(number) {
  return (await getSession(number)).userId;
}

/**
 * Perform an authenticated request. Injects the bearer token and, on a 401,
 * refreshes the session once and retries.
 */
async function authedRequest(number, { method = 'GET', path, json, formData }, isRetry = false) {
  const token = await getToken(number, isRetry);
  const headers = { Authorization: `Bearer ${token}` };
  let body;
  if (formData) {
    body = formData; // fetch sets the multipart Content-Type (with boundary) itself
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  const res = await fetch(url(path), {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 401 && !isRetry) {
    logger.debug(`401 for ${number}, refreshing session and retrying`);
    sessionCache.delete(number);
    return authedRequest(number, { method, path, json, formData }, true);
  }
  if (!res.ok) {
    throw new ApiError(await extractMessage(res, `Request failed (${res.status}).`), res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

async function getProfile(number) {
  const userId = await getUserId(number);
  const body = await authedRequest(number, { method: 'GET', path: `/api/users/${userId}` });
  return body.data.user;
}

async function updateProfile(number, name) {
  const userId = await getUserId(number);
  const body = await authedRequest(number, { method: 'PUT', path: `/api/users/${userId}`, json: { name } });
  return body.data.user;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

async function uploadFile(number, buffer, filename, contentType) {
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: contentType }), filename);
  formData.append('convert', 'true');
  const body = await authedRequest(number, { method: 'POST', path: '/api/files', formData });
  return body.data.file;
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

async function listShops(number) {
  const body = await authedRequest(number, { method: 'GET', path: '/api/shops' });
  return body.data.shops;
}

async function getShop(number, shopId) {
  const body = await authedRequest(number, { method: 'GET', path: `/api/shops/${shopId}` });
  return body.data.shop;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

async function createDraft(number, payload) {
  const body = await authedRequest(number, { method: 'POST', path: '/api/drafts', json: payload });
  return body.data.draft;
}

async function getDraft(number, draftId) {
  const body = await authedRequest(number, { method: 'GET', path: `/api/drafts/${draftId}` });
  return body.data.draft;
}

async function editDraft(number, draftId, payload) {
  const body = await authedRequest(number, { method: 'PUT', path: `/api/drafts/${draftId}`, json: payload });
  return body.data.draft;
}

async function deleteDraft(number, draftId) {
  await authedRequest(number, { method: 'DELETE', path: `/api/drafts/${draftId}` });
}

async function checkDraft(number, draftId) {
  const body = await authedRequest(number, { method: 'PATCH', path: `/api/drafts/${draftId}/check` });
  return body.data.draft;
}

async function submitDraft(number, draftId) {
  const body = await authedRequest(number, { method: 'PATCH', path: `/api/drafts/${draftId}/submit` });
  return body.data.job;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function listJobs(number) {
  const body = await authedRequest(number, { method: 'GET', path: '/api/jobs' });
  return body.data.jobs;
}

async function updateJobStatus(number, jobId, status) {
  const body = await authedRequest(number, {
    method: 'PATCH',
    path: `/api/jobs/${jobId}/status`,
    json: { status },
  });
  return body.data.job;
}

module.exports = {
  ApiError,
  getToken,
  getUserId,
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
