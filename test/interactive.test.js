'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  encodeId,
  decodeId,
  truncate,
  buildButtonsInteractive,
  buildListInteractive,
  MAX_ROW_ID_LENGTH,
} = require('../src/interactive');

test('encodeId/decodeId round-trip', () => {
  const id = encodeId('shop', 'select', '64f1a2b3c4d5e6f7a8b9c0d1');
  assert.equal(id, 'shop:select:64f1a2b3c4d5e6f7a8b9c0d1');
  assert.deepEqual(decodeId(id), ['shop', 'select', '64f1a2b3c4d5e6f7a8b9c0d1']);
});

test('encodeId throws if the composed id exceeds the length limit', () => {
  const tooLong = 'x'.repeat(MAX_ROW_ID_LENGTH + 1);
  assert.throws(() => encodeId('domain', 'verb', tooLong));
});

test('truncate leaves short strings untouched and ellipsizes long ones', () => {
  assert.equal(truncate('short', 20), 'short');
  const long = 'a'.repeat(30);
  const result = truncate(long, 20);
  assert.equal(result.length, 20);
  assert.ok(result.endsWith('…'));
});

test('buildButtonsInteractive enforces the 1-3 button limit', () => {
  assert.throws(() => buildButtonsInteractive('body', []));
  assert.throws(() => buildButtonsInteractive('body', [
    { id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 'd', title: 'D' },
  ]));
  const ok = buildButtonsInteractive('body', [{ id: 'a', title: 'A' }]);
  assert.equal(ok.type, 'button');
  assert.equal(ok.action.buttons.length, 1);
});

test('buildListInteractive enforces the 10-row total limit and truncates titles', () => {
  const longTitle = 'a very long row title that exceeds the limit';
  const list = buildListInteractive('body', 'Open', [
    { title: 'Section', rows: [{ id: 'x', title: longTitle, description: 'desc' }] },
  ]);
  assert.equal(list.type, 'list');
  assert.ok(list.action.sections[0].rows[0].title.length <= 24);

  const tooManyRows = Array.from({ length: 11 }, (_, i) => ({ id: `id${i}`, title: `Row ${i}` }));
  assert.throws(() => buildListInteractive('body', 'Open', [{ title: 'Section', rows: tooManyRows }]));
});
