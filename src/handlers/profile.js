'use strict';

const api = require('../api');
const whatsapp = require('../whatsapp');
const format = require('../format');
const state = require('../state');
const { encodeId } = require('../interactive');

async function showProfile(to) {
  const profile = await api.getProfile(to);
  await whatsapp.sendButtons(to, format.formatProfile(profile), [
    { id: encodeId('profile', 'rename'), title: 'Rename' },
    { id: encodeId('menu', 'root'), title: 'Menu' },
  ]);
}

async function promptRename(to) {
  state.setPendingInput(to, { kind: 'profile-rename' });
  await whatsapp.sendText(to, 'What would you like your new name to be? (max 60 characters)');
}

async function handleRenameInput(to, text) {
  const name = (text || '').trim();
  if (!name) {
    await whatsapp.sendText(to, 'Please send a non-empty name, or send anything else to cancel.');
    return;
  }
  if (name.length > 60) {
    await whatsapp.sendText(to, 'That name is too long. Please keep it under 60 characters.');
    return;
  }
  state.clearPendingInput(to);
  const profile = await api.updateProfile(to, name);
  await whatsapp.sendText(to, `✅ Your name is now *${profile.name}*.`);
}

module.exports = { showProfile, promptRename, handleRenameInput };
