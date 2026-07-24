'use strict';

const config = require('./config');
const logger = require('./logger');
const { buildButtonsInteractive, buildListInteractive } = require('./interactive');

const REQUEST_TIMEOUT_MS = 30000;

function graphUrl(path) {
  return `${config.graphApiBaseUrl}/${config.graphApiVersion}/${path}`;
}

/** Low-level authenticated Graph API request. */
async function graphRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(graphUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(body && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body && !(body instanceof Uint8Array) ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error(`Graph API request failed (${res.status}): ${path} — ${text}`);
    throw new Error(`Graph API request failed (${res.status})`);
  }
  return res;
}

async function sendMessage(payload) {
  const res = await graphRequest(`${config.wabaPhoneNumberId}/messages`, {
    method: 'POST',
    body: { messaging_product: 'whatsapp', to: payload.to, ...payload },
  });
  return res.json();
}

async function sendText(to, body, { previewUrl = false } = {}) {
  return sendMessage({ to, type: 'text', text: { body, preview_url: previewUrl } });
}

/** Send a reply-buttons message. `buttons`: [{id, title}], max 3. */
async function sendButtons(to, bodyText, buttons, opts = {}) {
  return sendMessage({ to, type: 'interactive', interactive: buildButtonsInteractive(bodyText, buttons, opts) });
}

/** Send a list message. `sections`: [{title, rows: [{id, title, description}]}]. */
async function sendList(to, bodyText, buttonLabel, sections, opts = {}) {
  return sendMessage({
    to,
    type: 'interactive',
    interactive: buildListInteractive(bodyText, buttonLabel, sections, opts),
  });
}

async function markAsRead(messageId) {
  try {
    await graphRequest(`${config.wabaPhoneNumberId}/messages`, {
      method: 'POST',
      body: { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    });
  } catch (err) {
    logger.warn(`Failed to mark ${messageId} as read:`, err.message);
  }
}

/** Resolve a media id to a short-lived, bearer-authed download URL. */
async function getMediaUrl(mediaId) {
  const res = await graphRequest(mediaId);
  return res.json();
}

/** Download media bytes: resolve the URL, then fetch it with the same bearer token. */
async function downloadMedia(mediaId) {
  const { url, mime_type: mimeType } = await getMediaUrl(mediaId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Failed to download media ${mediaId} (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType };
}

module.exports = {
  sendText,
  sendButtons,
  sendList,
  markAsRead,
  getMediaUrl,
  downloadMedia,
};
