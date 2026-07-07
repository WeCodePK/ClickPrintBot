'use strict';

const api = require('./api');
const draft = require('./draft');
const session = require('./session');
const fmt = require('./format');
const { parseSetting } = require('./settings');
const logger = require('./logger');

// Each handler receives a context: { number, args, argStr, reply }
//   number  – the user's phone number (bare, no @c.us)
//   args    – message body split into tokens (command removed)
//   argStr  – the raw argument string (everything after the command)
//   reply   – async (text) => sends a WhatsApp reply

async function help({ reply }) {
  await reply(fmt.helpText());
}

async function profile({ number, reply }) {
  const p = await api.getProfile(number);
  await reply(fmt.formatProfile(p));
}

async function updateName({ number, argStr, reply }) {
  const name = argStr.trim();
  if (!name) {
    await reply('Usage: /name <new name>\nExample: /name Abdul Ahad');
    return;
  }
  if (name.length > 60) {
    await reply('That name is too long. Please keep it under 60 characters.');
    return;
  }
  const p = await api.updateProfile(number, name);
  await reply(`✅ Your name is now *${p.name}*.`);
}

async function showDraft({ number, reply }) {
  const d = await draft.loadActiveDraft(number);
  if (!d) {
    await reply('You have no active draft. Send me a file to start an order.');
    return;
  }
  await reply(fmt.formatDraft(d));
}

async function showFiles({ number, reply }) {
  const d = await draft.loadActiveDraft(number);
  if (!d || !d.files || !d.files.length) {
    await reply('No files in your draft yet. Send me an image or document to add one.');
    return;
  }
  await reply(fmt.formatDraft(d));
}

async function setSetting({ number, args, reply }) {
  // /set <file#> <option> <value...>
  if (args.length < 3) {
    await reply('Usage: /set <file#> <option> <value>\nExample: /set 1 color on\nSend /help for all options.');
    return;
  }
  const fileNo = Number.parseInt(args[0], 10);
  if (!Number.isInteger(fileNo) || fileNo < 1) {
    await reply('The file number must be 1 or more. Send /files to see them.');
    return;
  }
  const option = args[1];
  const value = args.slice(2).join(' ');
  const parsed = parseSetting(option, value);
  if (parsed.error) {
    await reply(`⚠️ ${parsed.error}`);
    return;
  }

  const result = await draft.updateFileSettings(number, fileNo - 1, parsed.patch);
  if (result.error === 'no-draft') {
    await reply('You have no active draft. Send me a file first.');
    return;
  }
  if (result.error === 'bad-index') {
    await reply(`There is no file ${fileNo}. Your draft has ${result.count} file(s). Send /files.`);
    return;
  }
  const updatedFile = result.draft.files[fileNo - 1];
  await reply(
    `✅ Updated file ${fileNo}:\n${fmt.formatSettings(updatedFile.settings)}`
  );
}

async function removeFile({ number, args, reply }) {
  const fileNo = Number.parseInt(args[0], 10);
  if (!Number.isInteger(fileNo) || fileNo < 1) {
    await reply('Usage: /removefile <file#>\nSend /files to see file numbers.');
    return;
  }
  const result = await draft.removeFile(number, fileNo - 1);
  if (result.error === 'no-draft') {
    await reply('You have no active draft.');
    return;
  }
  if (result.error === 'bad-index') {
    await reply(`There is no file ${fileNo}. Your draft has ${result.count} file(s).`);
    return;
  }
  await reply(`🗑️ Removed file ${fileNo}.\n\n${fmt.formatDraft(result.draft)}`);
}

async function listShops({ number, reply }) {
  const shops = await api.listShops(number);
  await session.cacheList(number, 'shops', shops.map((s) => s._id));
  await reply(fmt.formatShopList(shops));
}

async function selectShop({ number, args, reply }) {
  const shopNo = Number.parseInt(args[0], 10);
  if (!Number.isInteger(shopNo) || shopNo < 1) {
    await reply('Usage: /shop <number>\nSend /shops to see the list first.');
    return;
  }
  const shopId = await session.resolveFromList(number, 'shops', shopNo);
  if (!shopId) {
    await reply('I don\'t have that shop cached. Send /shops again, then /shop <number>.');
    return;
  }
  const result = await draft.setShop(number, shopId);
  await reply(`✅ Shop selected.\n\n${fmt.formatDraft(result.draft)}`);
}

async function discardDraft({ number, reply }) {
  const result = await draft.discard(number);
  if (result.error === 'no-draft') {
    await reply('You have no active draft to discard.');
    return;
  }
  await reply('🗑️ Draft discarded. Send a file whenever you want to start a new order.');
}

async function check({ number, reply }) {
  const d = await draft.loadActiveDraft(number);
  if (!d) {
    await reply('You have no active draft. Send me a file to start an order.');
    return;
  }
  if (!d.files || !d.files.length) {
    await reply('Your draft has no files yet. Send me an image or document.');
    return;
  }
  if (!d.shop) {
    await reply('Pick a shop first with /shops, then /shop <number>.');
    return;
  }
  const checked = await api.checkDraft(number, d._id);
  await reply(fmt.formatQuote(checked));
}

async function confirm({ number, reply }) {
  const draftId = await session.getActiveDraftId(number);
  if (!draftId) {
    await reply('You have no active draft to submit. Send me a file to start.');
    return;
  }
  const job = await api.submitDraft(number, draftId);
  await session.clearActiveDraft(number);
  await reply(
    `🎉 Order placed!\n\n${fmt.formatJob(job)}\n\nTrack it anytime with /jobs.`
  );
}

async function listJobs({ number, reply }) {
  const jobs = await api.listJobs(number);
  await session.cacheList(number, 'jobs', jobs.map((j) => j._id));
  await reply(fmt.formatJobList(jobs));
}

async function cancelJob({ number, args, reply }) {
  const jobNo = Number.parseInt(args[0], 10);
  if (!Number.isInteger(jobNo) || jobNo < 1) {
    await reply('Usage: /cancel <number>\nSend /jobs to see your jobs first.');
    return;
  }
  const jobId = await session.resolveFromList(number, 'jobs', jobNo);
  if (!jobId) {
    await reply('I don\'t have that job cached. Send /jobs again, then /cancel <number>.');
    return;
  }
  const job = await api.updateJobStatus(number, jobId, 'cancelled');
  await reply(`❌ Job cancelled.\n\n${fmt.formatJob(job)}`);
}

// Command name (and aliases) -> handler
const commands = {
  help,
  start: help,
  menu: help,
  profile,
  me: profile,
  name: updateName,
  rename: updateName,
  draft: showDraft,
  files: showFiles,
  set: setSetting,
  removefile: removeFile,
  rmfile: removeFile,
  shops: listShops,
  shop: selectShop,
  canceldraft: discardDraft,
  discard: discardDraft,
  check: check,
  quote: check,
  confirm,
  submit: confirm,
  jobs: listJobs,
  orders: listJobs,
  cancel: cancelJob,
};

/** Handle a media message: upload the file and add it to the draft. */
async function handleMedia({ number, media, reply }) {
  const buffer = Buffer.from(media.data, 'base64');
  const filename = media.filename || defaultFilename(media.mimetype);

  await reply('📤 Uploading your file…');
  const uploaded = await api.uploadFile(number, buffer, filename, media.mimetype);
  logger.info(`Uploaded ${filename} (${uploaded._id}) for ${number}`);

  const updatedDraft = await draft.addFile(number, uploaded._id);
  const fileCount = (updatedDraft.files || []).length;
  const pages = uploaded.numberOfPages ? ` (${uploaded.numberOfPages} page(s))` : '';

  await reply(
    `✅ Added *${uploaded.originalName}*${pages}. That's file ${fileCount} in your draft.\n\n` +
      `${fmt.formatDraft(updatedDraft)}`
  );
}

function defaultFilename(mimetype) {
  const ext = (mimetype || '').split('/')[1] || 'bin';
  return `upload-${Date.now()}.${ext}`;
}

module.exports = { commands, handleMedia };
