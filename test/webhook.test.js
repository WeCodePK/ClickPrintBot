'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const webhook = require('../src/webhook');

const SECRET = 'test-app-secret';

function sign(body, secret = SECRET) {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

test('verifySignature accepts a correctly signed body', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(webhook.verifySignature(body, sign(body), SECRET), true);
});

test('verifySignature rejects a tampered body', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = sign(body);
  const tampered = Buffer.from(JSON.stringify({ hello: 'mallory' }));
  assert.equal(webhook.verifySignature(tampered, signature, SECRET), false);
});

test('verifySignature rejects a signature from the wrong secret', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(webhook.verifySignature(body, sign(body, 'wrong-secret'), SECRET), false);
});

test('verifySignature rejects a missing or malformed header', () => {
  const body = Buffer.from('{}');
  assert.equal(webhook.verifySignature(body, undefined, SECRET), false);
  assert.equal(webhook.verifySignature(body, 'not-a-signature', SECRET), false);
  assert.equal(webhook.verifySignature(body, 'sha256=', SECRET), false);
});

test('extractEvents normalizes a text message', () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Ada' } }],
          messages: [{ id: 'wamid.1', from: '15550001111', type: 'text', text: { body: 'hi' } }],
        },
      }],
    }],
  };
  const events = webhook.extractEvents(body);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    kind: 'message',
    from: '15550001111',
    name: 'Ada',
    waMessageId: 'wamid.1',
    type: 'text',
    text: 'hi',
  });
});

test('extractEvents normalizes a list_reply interactive message', () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Ada' } }],
          messages: [{
            id: 'wamid.2',
            from: '15550001111',
            type: 'interactive',
            interactive: { type: 'list_reply', list_reply: { id: 'shop:select:abc123', title: 'Shop' } },
          }],
        },
      }],
    }],
  };
  const [event] = webhook.extractEvents(body);
  assert.equal(event.interactiveType, 'list_reply');
  assert.equal(event.actionId, 'shop:select:abc123');
});

test('extractEvents deduplicates a message id seen twice (retried delivery)', () => {
  const body = {
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Ada' } }],
          messages: [{ id: 'wamid.dup', from: '1', type: 'text', text: { body: 'hi' } }],
        },
      }],
    }],
  };
  const first = webhook.extractEvents(body);
  const second = webhook.extractEvents(body);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});

test('extractEvents surfaces status updates as kind:status, never routed as messages', () => {
  const body = {
    entry: [{
      changes: [{
        value: { statuses: [{ id: 'wamid.3', status: 'delivered', recipient_id: '1' }] },
      }],
    }],
  };
  const [event] = webhook.extractEvents(body);
  assert.equal(event.kind, 'status');
  assert.equal(event.status, 'delivered');
});
