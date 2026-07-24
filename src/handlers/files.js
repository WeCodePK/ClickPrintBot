'use strict';

const api = require('../api');
const draft = require('../draft');
const whatsapp = require('../whatsapp');
const format = require('../format');
const state = require('../state');
const config = require('../config');
const settings = require('../settings');
const { encodeId } = require('../interactive');

const UPLOADABLE_TYPES = new Set(['image', 'document']);

// Field definitions for the per-file settings screen. `kind: 'enum'` fields
// are driven entirely by button taps; `kind: 'text'` fields prompt for a
// free-text reply, validated via settings.js.
const FIELD_DEFS = {
  color: {
    title: 'Color',
    kind: 'enum',
    describe: (s) => (s.color ? 'Colour' : 'B&W'),
    options: [
      { value: 'true', title: 'Colour' },
      { value: 'false', title: 'B&W' },
    ],
  },
  sidedness: {
    title: 'Sided',
    kind: 'enum',
    describe: (s) => ({ none: 'Single-sided', long: 'Double (long edge)', short: 'Double (short edge)' }[s.sidedness] || s.sidedness),
    options: [
      { value: 'none', title: 'Single-sided' },
      { value: 'long', title: 'Double (long)' },
      { value: 'short', title: 'Double (short)' },
    ],
  },
  orientation: {
    title: 'Orientation',
    kind: 'enum',
    describe: (s) => s.orientation,
    options: [
      { value: 'portrait', title: 'Portrait' },
      { value: 'landscape', title: 'Landscape' },
    ],
  },
  numberOfCopies: {
    title: 'Copies',
    kind: 'text',
    describe: (s) => `${s.numberOfCopies}`,
    prompt: 'Reply with the number of copies (1 or more).',
    validate: settings.validateCopies,
  },
  pageSelection: {
    title: 'Pages',
    kind: 'text',
    describe: (s) => (s.pageSelection ? s.pageSelection : 'All pages'),
    prompt: 'Reply with the pages to print, e.g. 1-3,5 — or send "all" for every page.',
    validate: settings.validatePageSelection,
  },
  pagesPerSheet: {
    title: 'Per Sheet',
    kind: 'text',
    describe: (s) => `${s.pagesPerSheet}`,
    prompt: 'Reply with the number of pages per sheet (1 or more).',
    validate: settings.validatePagesPerSheet,
  },
  pageType: {
    title: 'Page Type',
    kind: 'text',
    describe: (s) => s.pageType,
    prompt: 'Reply with the page size, e.g. A4.',
    validate: settings.validatePageType,
  },
};

function defaultFilename(mimetype) {
  const ext = config.extensionByMimeType[mimetype] || (mimetype || '').split('/')[1] || 'bin';
  return `upload-${Date.now()}.${ext}`;
}

async function handleMediaMessage(to, event) {
  if (!UPLOADABLE_TYPES.has(event.type)) {
    await whatsapp.sendText(to, 'I can only print images and documents. Please send your file as a photo or a document.');
    return;
  }

  await whatsapp.sendText(to, '📤 Uploading your file…');
  const { buffer, mimeType } = await whatsapp.downloadMedia(event.mediaId);
  const filename = event.filename || defaultFilename(mimeType || event.mimeType);

  const uploaded = await api.uploadFile(to, buffer, filename, mimeType || event.mimeType);
  await draft.addFile(to, uploaded._id);

  const pages = uploaded.numberOfPages ? ` (${uploaded.numberOfPages} page(s))` : '';
  await whatsapp.sendText(to, `✅ Added *${uploaded.originalName}*${pages} to your draft.`);
  await showDraft(to);
}

function fileId(f) {
  return f.file && f.file._id ? f.file._id : f.file;
}

function fileName(f) {
  return (f.file && f.file.originalName) || 'file';
}

async function showDraft(to) {
  const d = await draft.loadActiveDraft(to);
  if (!d) {
    await whatsapp.sendText(to, 'You have no active draft yet. Send me an image or document to start one.');
    return;
  }

  const sections = [];
  if (d.files && d.files.length) {
    sections.push({
      title: 'Files',
      rows: d.files.slice(0, 6).map((f) => ({
        id: encodeId('file', 'edit', fileId(f)),
        title: fileName(f),
        description: format.formatSettings(f.settings),
      })),
    });
  }

  const ready = Boolean(d.files && d.files.length && d.shop);
  const actionRows = [
    { id: encodeId('menu', 'shops'), title: d.shop ? 'Change Shop' : 'Pick a Shop', description: d.shop ? d.shop.name : undefined },
  ];
  if (ready) actionRows.push({ id: encodeId('draft', 'check'), title: 'Check Price', description: 'See a cost breakdown' });
  actionRows.push({ id: encodeId('draft', 'discard'), title: 'Discard Draft', description: 'Start over' });
  actionRows.push({ id: encodeId('menu', 'root'), title: 'Back to Menu' });
  sections.push({ title: 'Actions', rows: actionRows });

  await whatsapp.sendList(to, format.formatDraftSummary(d), 'Open Draft', sections);
}

async function showFileSettings(to, fileIdArg) {
  const d = await draft.loadActiveDraft(to);
  if (!d) {
    await whatsapp.sendText(to, 'That draft no longer exists.');
    await showDraft(to);
    return;
  }
  const index = draft.findFileIndex(d, fileIdArg);
  if (index === -1) {
    await whatsapp.sendText(to, "I couldn't find that file — it may have been removed already.");
    await showDraft(to);
    return;
  }
  const f = d.files[index];
  const fieldRows = Object.entries(FIELD_DEFS).map(([key, def]) => ({
    id: encodeId('file', 'field', key, fileIdArg),
    title: def.title,
    description: def.describe(f.settings),
  }));

  await whatsapp.sendList(
    to,
    `⚙️ Settings for *${fileName(f)}*`,
    'Edit Settings',
    [
      { title: 'Print Settings', rows: fieldRows },
      {
        title: 'More',
        rows: [
          { id: encodeId('file', 'remove', fileIdArg), title: 'Remove File' },
          { id: encodeId('draft', 'back'), title: 'Back to Draft' },
        ],
      },
    ]
  );
}

async function showFieldOptions(to, field, fileIdArg) {
  const def = FIELD_DEFS[field];
  if (!def) {
    await whatsapp.sendText(to, "Sorry, I don't recognise that setting.");
    await showFileSettings(to, fileIdArg);
    return;
  }
  if (def.kind === 'text') {
    state.setPendingInput(to, { kind: 'file-field', field, fileId: fileIdArg });
    await whatsapp.sendText(to, def.prompt);
    return;
  }
  await whatsapp.sendButtons(
    to,
    `Choose a value for *${def.title}*:`,
    def.options.map((o) => ({ id: encodeId('file', 'set', field, o.value, fileIdArg), title: o.title }))
  );
}

async function applyFieldChoice(to, field, value, fileIdArg) {
  const def = FIELD_DEFS[field];
  if (!def) return;
  const patch = { [field]: field === 'color' ? value === 'true' : value };
  const result = await draft.updateFileSettings(to, fileIdArg, patch);
  if (result.error) {
    await whatsapp.sendText(to, 'That draft or file no longer exists.');
    await showDraft(to);
    return;
  }
  await showFileSettings(to, fileIdArg);
}

async function handlePendingFieldInput(to, pending, text) {
  const def = FIELD_DEFS[pending.field];
  const { value, error } = def.validate(text);
  if (error) {
    await whatsapp.sendText(to, `⚠️ ${error}`);
    return; // keep the pending prompt so the user can retry
  }
  state.clearPendingInput(to);
  const result = await draft.updateFileSettings(to, pending.fileId, { [pending.field]: value });
  if (result.error) {
    await whatsapp.sendText(to, 'That draft or file no longer exists.');
    await showDraft(to);
    return;
  }
  await showFileSettings(to, pending.fileId);
}

async function removeFile(to, fileIdArg) {
  const result = await draft.removeFile(to, fileIdArg);
  if (result.error) {
    await whatsapp.sendText(to, 'That file was already removed.');
  } else {
    await whatsapp.sendText(to, '🗑️ File removed.');
  }
  await showDraft(to);
}

module.exports = {
  handleMediaMessage,
  showDraft,
  showFileSettings,
  showFieldOptions,
  applyFieldChoice,
  handlePendingFieldInput,
  removeFile,
};
