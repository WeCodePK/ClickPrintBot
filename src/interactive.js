'use strict';

// Builders for WhatsApp Cloud API interactive message payloads, plus the
// action-id encoding scheme used to route button/list taps back to a
// handler. See the migration plan for the full domain:verb table.
//
// Meta limits: reply button id <=256 chars / title <=20 / max 3 buttons.
// List row id <=200 chars / row title <=24 / row description <=72 /
// max 10 rows total across sections / section title <=24 / CTA label <=20.

const MAX_ROW_ID_LENGTH = 200;
const MAX_BUTTON_TITLE = 20;
const MAX_ROW_TITLE = 24;
const MAX_ROW_DESCRIPTION = 72;
const MAX_LIST_ROWS = 10;
const MAX_BUTTONS = 3;

/** Encode a routable action id as `domain:verb:arg...`. */
function encodeId(...parts) {
  const id = parts.map(String).join(':');
  if (id.length > MAX_ROW_ID_LENGTH) {
    throw new Error(`Action id exceeds ${MAX_ROW_ID_LENGTH} chars: ${id}`);
  }
  return id;
}

/** Decode an action id back into [domain, verb, ...args]. */
function decodeId(id) {
  return String(id || '').split(':');
}

function truncate(str, max) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function replyButton(id, title) {
  return { type: 'reply', reply: { id, title: truncate(title, MAX_BUTTON_TITLE) } };
}

/** Build a `type: 'button'` interactive payload. Max 3 buttons. */
function buildButtonsInteractive(bodyText, buttons, { header, footer } = {}) {
  if (!buttons.length || buttons.length > MAX_BUTTONS) {
    throw new Error(`buildButtonsInteractive expects 1-${MAX_BUTTONS} buttons, got ${buttons.length}`);
  }
  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: { buttons: buttons.map((b) => replyButton(b.id, b.title)) },
  };
  if (header) interactive.header = { type: 'text', text: header };
  if (footer) interactive.footer = { text: footer };
  return interactive;
}

/** Build a `type: 'list'` interactive payload. Max 10 rows total. */
function buildListInteractive(bodyText, buttonLabel, sections, { header, footer } = {}) {
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  if (totalRows === 0 || totalRows > MAX_LIST_ROWS) {
    throw new Error(`buildListInteractive expects 1-${MAX_LIST_ROWS} rows total, got ${totalRows}`);
  }
  const interactive = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: truncate(buttonLabel, MAX_BUTTON_TITLE),
      sections: sections.map((s) => ({
        title: truncate(s.title, MAX_ROW_TITLE),
        rows: s.rows.map((r) => ({
          id: r.id,
          title: truncate(r.title, MAX_ROW_TITLE),
          ...(r.description ? { description: truncate(r.description, MAX_ROW_DESCRIPTION) } : {}),
        })),
      })),
    },
  };
  if (header) interactive.header = { type: 'text', text: header };
  if (footer) interactive.footer = { text: footer };
  return interactive;
}

module.exports = {
  MAX_ROW_ID_LENGTH,
  MAX_LIST_ROWS,
  MAX_BUTTONS,
  encodeId,
  decodeId,
  truncate,
  replyButton,
  buildButtonsInteractive,
  buildListInteractive,
};
