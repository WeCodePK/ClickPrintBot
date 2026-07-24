'use strict';

// Validators for the three per-file settings that aren't enumerable to
// buttons/list rows and are instead captured as a free-text reply. The other
// fields (color, sidedness, orientation) are fixed enums driven entirely by
// button/list taps, so they never need to be parsed from user text.

function parseInt1(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/** copies: a whole number >= 1. */
function validateCopies(text) {
  const n = parseInt1((text || '').trim());
  if (!n) return { error: 'Copies must be a whole number of 1 or more. Please try again.' };
  return { value: n };
}

/** pages: e.g. "1-3,5" (blank = all pages). */
function validatePageSelection(text) {
  const value = (text || '').trim();
  if (value.toLowerCase() === 'all') return { value: '' };
  if (value && !/^[0-9,\-\s]+$/.test(value)) {
    return { error: 'Pages must look like 1-3,5 (numbers, commas, dashes) — or send "all" for every page.' };
  }
  return { value: value.replace(/\s+/g, '') };
}

/** page type / size, e.g. "A4" — free-form, normalized to uppercase. */
function validatePageType(text) {
  const value = (text || '').trim();
  if (!value) return { error: 'Please send a page size, e.g. A4.' };
  return { value: value.toUpperCase() };
}

/** pages per sheet: a whole number >= 1. */
function validatePagesPerSheet(text) {
  const n = parseInt1((text || '').trim());
  if (!n) return { error: 'Pages-per-sheet must be a whole number of 1 or more. Please try again.' };
  return { value: n };
}

module.exports = {
  validateCopies,
  validatePageSelection,
  validatePageType,
  validatePagesPerSheet,
};
