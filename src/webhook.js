'use strict';

const crypto = require('node:crypto');
const state = require('./state');

/** Verify Meta's `X-Hub-Signature-256` header against the raw request body. */
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

const MEDIA_TYPES = new Set(['image', 'document', 'video', 'audio', 'sticker']);

/** Normalize a single Cloud API `messages[]` entry into a routable event. */
function normalizeMessage(value, message) {
  const contact = (value.contacts || [])[0];
  const event = {
    kind: 'message',
    from: message.from,
    name: contact?.profile?.name,
    waMessageId: message.id,
    type: message.type,
  };

  if (message.type === 'text') {
    event.text = message.text?.body || '';
  } else if (MEDIA_TYPES.has(message.type)) {
    const media = message[message.type] || {};
    event.mediaId = media.id;
    event.mimeType = media.mime_type;
    event.filename = media.filename || null;
  } else if (message.type === 'interactive') {
    const interactive = message.interactive || {};
    event.interactiveType = interactive.type;
    if (interactive.type === 'button_reply') {
      event.actionId = interactive.button_reply?.id;
    } else if (interactive.type === 'list_reply') {
      event.actionId = interactive.list_reply?.id;
    }
  }

  return event;
}

/**
 * Walk a Cloud API webhook body and return a flat array of normalized
 * events: `{kind: 'message', ...}` for inbound messages/interactive replies
 * (deduped against retried deliveries) and `{kind: 'status', ...}` for
 * delivery receipts, which callers should log but never route.
 */
function extractEvents(body) {
  const events = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      for (const message of value.messages || []) {
        if (!state.markSeen(message.id)) continue;
        events.push(normalizeMessage(value, message));
      }

      for (const status of value.statuses || []) {
        events.push({ kind: 'status', id: status.id, status: status.status, recipientId: status.recipient_id });
      }
    }
  }

  return events;
}

module.exports = { verifySignature, extractEvents, normalizeMessage };
