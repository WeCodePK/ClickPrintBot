'use strict';

const api = require('./api');
const session = require('./session');
const config = require('./config');

/** Convert a populated draft (from the API) back into an editable payload. */
function toPayload(draft) {
  const payload = {
    files: (draft.files || []).map((f) => ({
      file: f.file && f.file._id ? f.file._id : f.file,
      settings: f.settings,
    })),
  };
  if (draft.shop) payload.shop = draft.shop._id || draft.shop;
  return payload;
}

/** Load the user's active draft (populated), or null if there is none. */
async function loadActiveDraft(number) {
  const draftId = await session.getActiveDraftId(number);
  if (!draftId) return null;
  try {
    return await api.getDraft(number, draftId);
  } catch (err) {
    // Draft was deleted/expired backend-side; forget the stale pointer.
    if (err.status === 404) {
      await session.clearActiveDraft(number);
      return null;
    }
    throw err;
  }
}

/** Add a freshly-uploaded file to the active draft, creating one if needed. */
async function addFile(number, fileId) {
  const draft = await loadActiveDraft(number);
  const newEntry = { file: fileId, settings: { ...config.defaultSettings } };

  if (!draft) {
    const created = await api.createDraft(number, { files: [newEntry] });
    await session.setActiveDraftId(number, created._id);
    return created;
  }

  const payload = toPayload(draft);
  payload.files.push(newEntry);
  return api.editDraft(number, draft._id, payload);
}

async function setShop(number, shopId) {
  // A shop can be chosen before any files exist — create the draft if needed.
  const existing = await loadActiveDraft(number);
  if (!existing) {
    const created = await api.createDraft(number, { shop: shopId, files: [] });
    await session.setActiveDraftId(number, created._id);
    return { draft: created };
  }
  // Edit Draft accepts a partial body, so we only send the changed field.
  const updated = await api.editDraft(number, existing._id, { shop: shopId });
  return { draft: updated };
}

async function updateFileSettings(number, fileIndex, patch) {
  const draft = await loadActiveDraft(number);
  if (!draft) return { error: 'no-draft' };
  if (fileIndex < 0 || fileIndex >= (draft.files || []).length) {
    return { error: 'bad-index', count: (draft.files || []).length };
  }
  const payload = toPayload(draft);
  payload.files[fileIndex].settings = { ...payload.files[fileIndex].settings, ...patch };
  const updated = await api.editDraft(number, draft._id, payload);
  return { draft: updated };
}

async function removeFile(number, fileIndex) {
  const draft = await loadActiveDraft(number);
  if (!draft) return { error: 'no-draft' };
  if (fileIndex < 0 || fileIndex >= (draft.files || []).length) {
    return { error: 'bad-index', count: (draft.files || []).length };
  }
  const payload = toPayload(draft);
  payload.files.splice(fileIndex, 1);
  const updated = await api.editDraft(number, draft._id, payload);
  return { draft: updated };
}

async function discard(number) {
  const draftId = await session.getActiveDraftId(number);
  if (!draftId) return { error: 'no-draft' };
  try {
    await api.deleteDraft(number, draftId);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  await session.clearActiveDraft(number);
  return { ok: true };
}

module.exports = {
  toPayload,
  loadActiveDraft,
  addFile,
  setShop,
  updateFileSettings,
  removeFile,
  discard,
};
