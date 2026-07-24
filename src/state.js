'use strict';

const config = require('./config');

// ---------------------------------------------------------------------------
// All state is in-process only (no Redis): lost on restart, single-instance
// only. Accepted tradeoff — see migration plan.
// ---------------------------------------------------------------------------

const activeDrafts = new Map(); // number -> draftId
const pendingInputs = new Map(); // number -> { kind, field, fileId, createdAt }

function getActiveDraft(number) {
  return activeDrafts.get(number) || null;
}

function setActiveDraft(number, draftId) {
  activeDrafts.set(number, draftId);
}

function clearActiveDraft(number) {
  activeDrafts.delete(number);
}

function getPendingInput(number) {
  const pending = pendingInputs.get(number);
  if (!pending) return null;
  if (Date.now() - pending.createdAt > config.pendingInputTtlMs) {
    pendingInputs.delete(number);
    return null;
  }
  return pending;
}

function setPendingInput(number, data) {
  pendingInputs.set(number, { ...data, createdAt: Date.now() });
}

function clearPendingInput(number) {
  pendingInputs.delete(number);
}

// ---------------------------------------------------------------------------
// Per-user processing mutex — messages for the same user (e.g. an album
// burst, or a fast double-tap on a button) are serialised so they don't race
// each other while editing the same draft.
// ---------------------------------------------------------------------------

const chains = new Map();

function withUserLock(number, task) {
  const prev = chains.get(number) || Promise.resolve();
  const next = prev.then(task, task);
  chains.set(number, next.catch(() => {}));
  return next;
}

// ---------------------------------------------------------------------------
// Dedupe Meta's retried webhook deliveries by message id. Capped so it can't
// grow unbounded across a long-running process.
// ---------------------------------------------------------------------------

const SEEN_LIMIT = 5000;
const seenMessageIds = new Set();

function markSeen(messageId) {
  if (!messageId) return true;
  if (seenMessageIds.has(messageId)) return false;
  if (seenMessageIds.size >= SEEN_LIMIT) {
    const oldest = seenMessageIds.values().next().value;
    seenMessageIds.delete(oldest);
  }
  seenMessageIds.add(messageId);
  return true;
}

module.exports = {
  getActiveDraft,
  setActiveDraft,
  clearActiveDraft,
  getPendingInput,
  setPendingInput,
  clearPendingInput,
  withUserLock,
  markSeen,
};
