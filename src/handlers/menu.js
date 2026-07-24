'use strict';

const whatsapp = require('../whatsapp');
const format = require('../format');
const { encodeId } = require('../interactive');

async function showMainMenu(to, { preface } = {}) {
  const body = preface ? `${preface}\n\nWhat would you like to do?` : "Here's what I can do:";
  return whatsapp.sendList(to, body, 'Open Menu', [
    {
      title: 'Menu',
      rows: [
        { id: encodeId('menu', 'draft'), title: 'My Draft', description: 'View files and pick a shop' },
        { id: encodeId('menu', 'shops'), title: 'Print Shops', description: 'Browse available shops' },
        { id: encodeId('menu', 'jobs'), title: 'My Orders', description: 'Track or cancel a job' },
        { id: encodeId('menu', 'profile'), title: 'My Profile', description: 'Name & balance' },
        { id: encodeId('menu', 'help'), title: 'Help', description: 'How this bot works' },
      ],
    },
  ]);
}

async function showHelp(to) {
  await whatsapp.sendText(to, format.helpText());
}

module.exports = { showMainMenu, showHelp };
