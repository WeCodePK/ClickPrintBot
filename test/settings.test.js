'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const settings = require('../src/settings');

test('validateCopies accepts whole numbers >= 1', () => {
  assert.deepEqual(settings.validateCopies('3'), { value: 3 });
  assert.ok(settings.validateCopies('0').error);
  assert.ok(settings.validateCopies('abc').error);
});

test('validatePageSelection accepts ranges, blank, and "all"', () => {
  assert.deepEqual(settings.validatePageSelection('1-3,5'), { value: '1-3,5' });
  assert.deepEqual(settings.validatePageSelection('all'), { value: '' });
  assert.deepEqual(settings.validatePageSelection(''), { value: '' });
  assert.ok(settings.validatePageSelection('one to three').error);
});

test('validatePageType requires a non-empty value and uppercases it', () => {
  assert.deepEqual(settings.validatePageType('a4'), { value: 'A4' });
  assert.ok(settings.validatePageType('').error);
});

test('validatePagesPerSheet accepts whole numbers >= 1', () => {
  assert.deepEqual(settings.validatePagesPerSheet('2'), { value: 2 });
  assert.ok(settings.validatePagesPerSheet('0').error);
});
