'use strict';

const redis = require('./redis');
const config = require('./config');

const draftKey = (number) => `draft:${number}`;
const listKey = (number, kind) => `list:${kind}:${number}`;
const phoneKey = (chatId) => `pn:${chatId}`;

// ---------------------------------------------------------------------------
// Chat-id -> phone-number cache
//
// WhatsApp addresses chats by a stable LID (`@lid`) whose digits are NOT the
// phone number. Resolving the phone requires a round-trip to WhatsApp, so we
// cache the mapping (chat id -> phone) durably — the LID never changes.
// ---------------------------------------------------------------------------

function getCachedPhone(chatId) {
  return redis.get(phoneKey(chatId));
}

function setCachedPhone(chatId, phone) {
  return redis.set(phoneKey(chatId), phone);
}

// ---------------------------------------------------------------------------
// Active draft pointer
// ---------------------------------------------------------------------------

function getActiveDraftId(number) {
  return redis.get(draftKey(number));
}

function setActiveDraftId(number, draftId) {
  // Drafts are long-lived work-in-progress; keep the pointer for 7 days.
  return redis.set(draftKey(number), draftId, 'EX', 60 * 60 * 24 * 7);
}

function clearActiveDraft(number) {
  return redis.del(draftKey(number));
}

// ---------------------------------------------------------------------------
// Index-able list caches
//
// When we show the user a numbered list (shops, jobs), we cache the ordered
// ids so a later `/shop 2` or `/cancel 1` resolves the 1-based index to an id.
// ---------------------------------------------------------------------------

async function cacheList(number, kind, ids) {
  const key = listKey(number, kind);
  if (!ids.length) {
    await redis.del(key);
    return;
  }
  await redis.del(key);
  await redis.rpush(key, ...ids);
  await redis.expire(key, config.listCacheTtlSeconds);
}

/** Resolve a 1-based index (as the user typed it) to a cached id, or null. */
async function resolveFromList(number, kind, oneBasedIndex) {
  if (!Number.isInteger(oneBasedIndex) || oneBasedIndex < 1) return null;
  const id = await redis.lindex(listKey(number, kind), oneBasedIndex - 1);
  return id || null;
}

// ---------------------------------------------------------------------------
// Per-user processing mutex (in-memory, single-process)
//
// WhatsApp albums arrive as a burst of separate messages; serialising work per
// user avoids racing draft edits against each other.
// ---------------------------------------------------------------------------

const chains = new Map();

function withUserLock(number, task) {
  const prev = chains.get(number) || Promise.resolve();
  const next = prev.then(task, task);
  // Keep the chain alive but don't leak rejected promises.
  chains.set(number, next.catch(() => {}));
  return next;
}

module.exports = {
  getCachedPhone,
  setCachedPhone,
  getActiveDraftId,
  setActiveDraftId,
  clearActiveDraft,
  cacheList,
  resolveFromList,
  withUserLock,
};
