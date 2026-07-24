'use strict';

const draft = require('../draft');
const whatsapp = require('../whatsapp');
const format = require('../format');
const { encodeId } = require('../interactive');
const menu = require('./menu');
const files = require('./files');

async function checkQuote(to) {
  const result = await draft.checkDraft(to);
  if (result.error) {
    await whatsapp.sendText(to, 'You have no active draft. Send me a file to start an order.');
    return;
  }
  await whatsapp.sendButtons(to, format.formatQuote(result.draft), [
    { id: encodeId('draft', 'submit'), title: 'Confirm & Submit' },
    { id: encodeId('draft', 'back'), title: 'Back' },
  ]);
}

async function confirmSubmit(to) {
  const result = await draft.submitDraft(to);
  if (result.error) {
    await whatsapp.sendText(to, 'You have no active draft to submit. Send me a file to start.');
    return;
  }
  await whatsapp.sendText(to, `🎉 Order placed!\n\n${format.formatJobDetail(result.job)}`);
  await menu.showMainMenu(to);
}

async function discardDraft(to) {
  const result = await draft.discard(to);
  if (result.error) {
    await whatsapp.sendText(to, 'You have no active draft to discard.');
    return;
  }
  await whatsapp.sendText(to, '🗑️ Draft discarded. Send a file whenever you want to start a new order.');
}

async function backToDraft(to) {
  await files.showDraft(to);
}

module.exports = { checkQuote, confirmSubmit, discardDraft, backToDraft };
