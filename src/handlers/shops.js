'use strict';

const api = require('../api');
const draft = require('../draft');
const whatsapp = require('../whatsapp');
const format = require('../format');
const { encodeId } = require('../interactive');

// List messages allow at most 10 rows total.
const MAX_SHOP_ROWS = 10;

async function showShopList(to) {
  const shops = await api.listShops(to);
  if (!shops.length) {
    await whatsapp.sendText(to, 'No shops are available right now. Please check back later.');
    return;
  }
  const rows = shops.slice(0, MAX_SHOP_ROWS).map((s) => ({
    id: encodeId('shop', 'select', s._id),
    title: s.name,
    description: `${s.isOnline ? '🟢 online' : '⚪ offline'}${s.address ? ` · ${s.address}` : ''}`,
  }));
  await whatsapp.sendList(to, '🏪 Available shops — tap one to see details.', 'View Shops', [
    { title: 'Shops', rows },
  ]);
}

async function showShopDetail(to, shopId) {
  const shop = await api.getShop(to, shopId);
  await whatsapp.sendButtons(to, format.formatShopDetail(shop), [
    { id: encodeId('shop', 'choose', shopId), title: 'Select shop' },
    { id: encodeId('shop', 'back'), title: 'Back' },
  ]);
}

async function chooseShop(to, shopId) {
  const updated = await draft.setShop(to, shopId);
  await whatsapp.sendText(to, `✅ Shop selected.\n\n${format.formatDraftSummary(updated)}`);
}

module.exports = { showShopList, showShopDetail, chooseShop };
