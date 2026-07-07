'use strict';

const TRUE_WORDS = new Set(['on', 'yes', 'true', 'colour', 'color', 'coloured', '1']);
const FALSE_WORDS = new Set(['off', 'no', 'false', 'bw', 'b&w', 'mono', '0']);

// sidedness has three backend values: 'none' (single-sided), 'long' and
// 'short' (double-sided, bound on the long or short edge). Plain "double"
// defaults to long-edge, the common choice.
const SINGLE_WORDS = new Set(['single', 'one', 'ss', 'simplex', 'none']);
const LONG_WORDS = new Set(['long', 'long-edge', 'longedge', 'double', 'two', 'ds', 'duplex']);
const SHORT_WORDS = new Set(['short', 'short-edge', 'shortedge']);

function parseInt1(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * Parse a `/set` option + value into a settings patch.
 * Returns { patch } on success or { error } with a user-facing message.
 */
function parseSetting(optionRaw, valueRaw) {
  const option = (optionRaw || '').toLowerCase();
  const value = (valueRaw || '').trim();
  const valueLc = value.toLowerCase();

  switch (option) {
    case 'color':
    case 'colour': {
      if (TRUE_WORDS.has(valueLc)) return { patch: { color: true } };
      if (FALSE_WORDS.has(valueLc)) return { patch: { color: false } };
      return { error: 'Use: /set <file#> color on|off' };
    }
    case 'copies':
    case 'copy': {
      const n = parseInt1(value);
      if (!n) return { error: 'Copies must be a whole number of 1 or more.' };
      return { patch: { numberOfCopies: n } };
    }
    case 'sided':
    case 'sides':
    case 'sidedness': {
      if (SINGLE_WORDS.has(valueLc)) return { patch: { sidedness: 'none' } };
      if (LONG_WORDS.has(valueLc)) return { patch: { sidedness: 'long' } };
      if (SHORT_WORDS.has(valueLc)) return { patch: { sidedness: 'short' } };
      return { error: 'Use: /set <file#> sided single|double|short  (double = long-edge)' };
    }
    case 'orientation':
    case 'orient': {
      if (valueLc === 'portrait' || valueLc === 'landscape') {
        return { patch: { orientation: valueLc } };
      }
      return { error: 'Use: /set <file#> orientation portrait|landscape' };
    }
    case 'pages':
    case 'page':
    case 'range': {
      // Blank clears the selection (= all pages). Otherwise pass through.
      if (value && !/^[0-9,\-\s]+$/.test(value)) {
        return { error: 'Pages must look like 1-3,5 (numbers, commas, dashes).' };
      }
      return { patch: { pageSelection: value.replace(/\s+/g, '') } };
    }
    case 'perpage':
    case 'pagespersheet':
    case 'persheet': {
      const n = parseInt1(value);
      if (!n) return { error: 'Pages-per-sheet must be a whole number of 1 or more.' };
      return { patch: { pagesPerSheet: n } };
    }
    case 'type':
    case 'pagetype':
    case 'size': {
      if (!value) return { error: 'Use: /set <file#> type A4' };
      return { patch: { pageType: value.toUpperCase() } };
    }
    default:
      return {
        error:
          `Unknown option "${optionRaw}". Options: color, copies, sided, ` +
          'orientation, pages, perpage, type.',
      };
  }
}

module.exports = { parseSetting };
