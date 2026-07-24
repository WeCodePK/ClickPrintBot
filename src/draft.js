'use strict';

const api = require('./api');
const state = require('./state');
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

/** Find a file's index within a draft by its file id (never by position). */
function findFileIndex(draft, fileId) {
  return (draft.files || []).findIndex((f) => {
    const id = f.file && f.file._id ? f.file._id : f.file;
    return id === fileId;
  });
}

/** Load the user's active draft (populated), or null if there is none. */
async function loadActiveDraft(number) {
  const draftId = state.getActiveDraft(number);
  if (!draftId) return null;
  try {
    return await api.getDraft(number, draftId);
  } catch (err) {
    // Draft was deleted/expired backend-side; forget the stale pointer.
    if (err.status === 404) {
      state.clearActiveDraft(number);
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
    state.setActiveDraft(number, created._id);
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
    state.setActiveDraft(number, created._id);
    return created;
  }
  const payload = toPayload(existing);
  payload.shop = shopId;
  return api.editDraft(number, existing._id, payload);
}

async function updateFileSettings(number, fileId, patch) {
  const draft = await loadActiveDraft(number);
  if (!draft) return { error: 'no-draft' };
  const index = findFileIndex(draft, fileId);
  if (index === -1) return { error: 'not-found' };
  const payload = toPayload(draft);
  payload.files[index].settings = { ...payload.files[index].settings, ...patch };
  const updated = await api.editDraft(number, draft._id, payload);
  return { draft: updated };
}

async function removeFile(number, fileId) {
  const draft = await loadActiveDraft(number);
  if (!draft) return { error: 'no-draft' };
  const index = findFileIndex(draft, fileId);
  if (index === -1) return { error: 'not-found' };
  const payload = toPayload(draft);
  payload.files.splice(index, 1);
  const updated = await api.editDraft(number, draft._id, payload);
  return { draft: updated };
}

async function checkDraft(number) {
  const draftId = state.getActiveDraft(number);
  if (!draftId) return { error: 'no-draft' };
  const draft = await api.checkDraft(number, draftId);
  return { draft };
}

async function submitDraft(number) {
  const draftId = state.getActiveDraft(number);
  if (!draftId) return { error: 'no-draft' };
  const job = await api.submitDraft(number, draftId);
  state.clearActiveDraft(number);
  return { job };
}

async function discard(number) {
  const draftId = state.getActiveDraft(number);
  if (!draftId) return { error: 'no-draft' };
  try {
    await api.deleteDraft(number, draftId);
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  state.clearActiveDraft(number);
  return { ok: true };
}

module.exports = {
  toPayload,
  findFileIndex,
  loadActiveDraft,
  addFile,
  setShop,
  updateFileSettings,
  removeFile,
  checkDraft,
  submitDraft,
  discard,
};
