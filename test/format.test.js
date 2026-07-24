'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const format = require('../src/format');

const SETTINGS = {
  color: false,
  pageType: 'A4',
  pagesPerSheet: 1,
  orientation: 'portrait',
  sidedness: 'long',
  numberOfCopies: 1,
  pageSelection: '',
};

test('formatDraftFiles reads the file name from file.name (backend uses `name`, not `originalName`)', () => {
  const draft = {
    files: [{ file: { _id: '1', name: 'Report.pdf', numberOfPages: 3 }, settings: SETTINGS }],
  };
  const out = format.formatDraftFiles(draft);
  assert.match(out, /Report\.pdf/);
});

test('formatCost reads the object-shaped lines/extra (item/rate/quantity/subtotal)', () => {
  const cost = {
    lines: [{ item: 'A4-BW-DS', rate: 10, quantity: 1, subtotal: 10 }],
    extra: [{ item: 'Test Fee', subtotal: 10 }],
    total: 20,
  };
  const out = format.formatCost(cost);
  assert.match(out, /A4-BW-DS\s+1 × Rs 10 = Rs 10/);
  assert.match(out, /Test Fee: Rs 10/);
  assert.match(out, /Total: Rs 20/);
});

test('formatProfile omits the balance line when the user object has no balance', () => {
  const out = format.formatProfile({ name: 'Ahad', number: '923235400291' });
  assert.doesNotMatch(out, /Balance/);
  assert.match(out, /Ahad/);
});

test('formatProfile shows the balance line when present', () => {
  const out = format.formatProfile({ name: 'Ahad', number: '923235400291', balance: 500 });
  assert.match(out, /Balance: Rs 500/);
});
