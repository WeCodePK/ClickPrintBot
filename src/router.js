'use strict';

const state = require('./state');
const whatsapp = require('./whatsapp');
const logger = require('./logger');
const { ApiError } = require('./api');
const { decodeId } = require('./interactive');

const menu = require('./handlers/menu');
const profile = require('./handlers/profile');
const files = require('./handlers/files');
const shops = require('./handlers/shops');
const draftActions = require('./handlers/draftActions');
const jobs = require('./handlers/jobs');

const MEDIA_MESSAGE_TYPES = new Set(['image', 'document', 'video', 'audio', 'sticker']);

// domain:verb -> (to, ...args) => Promise
const DISPATCH = {
  menu: {
    root: (to) => menu.showMainMenu(to),
    draft: (to) => files.showDraft(to),
    shops: (to) => shops.showShopList(to),
    jobs: (to) => jobs.showJobList(to),
    profile: (to) => profile.showProfile(to),
    help: (to) => menu.showHelp(to),
  },
  profile: {
    rename: (to) => profile.promptRename(to),
  },
  file: {
    edit: (to, fileId) => files.showFileSettings(to, fileId),
    field: (to, field, fileId) => files.showFieldOptions(to, field, fileId),
    set: (to, field, value, fileId) => files.applyFieldChoice(to, field, value, fileId),
    remove: (to, fileId) => files.removeFile(to, fileId),
  },
  draft: {
    check: (to) => draftActions.checkQuote(to),
    submit: (to) => draftActions.confirmSubmit(to),
    discard: (to) => draftActions.discardDraft(to),
    back: (to) => draftActions.backToDraft(to),
  },
  shop: {
    select: (to, shopId) => shops.showShopDetail(to, shopId),
    choose: (to, shopId) => shops.chooseShop(to, shopId),
    back: (to) => shops.showShopList(to),
  },
  job: {
    view: (to, jobId) => jobs.showJobDetail(to, jobId),
    cancel: (to, jobId) => jobs.cancelJob(to, jobId),
    back: (to) => jobs.showJobList(to),
  },
};

const PENDING_HANDLERS = {
  'profile-rename': (to, pending, text) => profile.handleRenameInput(to, text),
  'file-field': (to, pending, text) => files.handlePendingFieldInput(to, pending, text),
};

async function handleEvent(event) {
  if (event.kind !== 'message') {
    logger.debug(`Status update: ${event.status} for ${event.id}`);
    return;
  }
  return state.withUserLock(event.from, () => handleMessage(event));
}

async function handleMessage(event) {
  try {
    const pending = state.getPendingInput(event.from);
    if (pending) {
      if (event.type === 'text') {
        const handler = PENDING_HANDLERS[pending.kind];
        if (handler) {
          await handler(event.from, pending, event.text);
          return;
        }
      }
      state.clearPendingInput(event.from);
    }

    if (event.type === 'interactive') {
      await handleInteractive(event);
      return;
    }
    if (event.type === 'image' || event.type === 'document') {
      await files.handleMediaMessage(event.from, event);
      return;
    }
    if (event.type === 'text') {
      await menu.showMainMenu(event.from, {
        preface: "👋 Send me a file to print, or pick something below.",
      });
      return;
    }
    if (MEDIA_MESSAGE_TYPES.has(event.type)) {
      await whatsapp.sendText(event.from, "I can only print images and documents right now.");
      await menu.showMainMenu(event.from);
      return;
    }
    logger.debug(`Ignoring unsupported message type: ${event.type}`);
  } catch (err) {
    await handleError(err, event.from);
  }
}

async function handleInteractive(event) {
  const [domain, verb, ...args] = decodeId(event.actionId);
  const handler = DISPATCH[domain] && DISPATCH[domain][verb];
  if (!handler) {
    logger.warn(`No handler for action id: ${event.actionId}`);
    await whatsapp.sendText(event.from, "Sorry, that option isn't available anymore.");
    await menu.showMainMenu(event.from);
    return;
  }
  await handler(event.from, ...args);
}

async function handleError(err, to) {
  if (err instanceof ApiError) {
    logger.warn(`API error for ${to}: ${err.message} (status ${err.status})`);
    await whatsapp.sendText(to, `⚠️ ${err.message}`);
    return;
  }
  logger.error(`Unhandled error for ${to}:`, err);
  await whatsapp.sendText(to, '😞 Something went wrong on my end. Please try again in a moment.');
}

module.exports = { handleEvent };
