'use strict';

const { commands, handleMedia } = require('./handlers');
const session = require('./session');
const { ApiError } = require('./api');
const logger = require('./logger');

const MEDIA_TYPES = new Set(['image', 'document', 'video', 'audio', 'sticker', 'ptt']);
const UPLOADABLE_TYPES = new Set(['image', 'document']);

function makeReply(msg) {
  return (text) => msg.reply(text);
}

/**
 * Work out the user's real phone number. WhatsApp now addresses some chats with
 * a `@lid` (linked id) instead of `@c.us`, whose local part is NOT the phone
 * number, so we prefer the number from the resolved contact and only fall back
 * to the id's local part.
 */
async function resolveNumber(msg) {
  try {
    const contact = await msg.getContact();
    if (contact && contact.number) return contact.number.replace(/\D/g, '');
  } catch (err) {
    logger.debug(`getContact failed for ${msg.from}: ${err.message}`);
  }
  return (msg.from || '').split('@')[0].replace(/\D/g, '');
}

function isGroupOrBroadcast(from) {
  return from.endsWith('@g.us') || from.endsWith('@broadcast') || from === 'status@broadcast';
}

async function route(msg) {
  // Only handle 1:1 user chats; skip groups, status broadcasts, own messages.
  if (msg.fromMe) return;
  const from = msg.from || '';
  if (isGroupOrBroadcast(from)) return;

  logger.info(`Incoming message from ${from} (type=${msg.type})`);

  const number = await resolveNumber(msg);
  if (!number) {
    logger.warn(`Could not resolve a phone number for ${from}, ignoring.`);
    return;
  }
  const reply = makeReply(msg);

  // Serialise per-user so album bursts don't race draft edits.
  await session.withUserLock(number, async () => {
    try {
      if (msg.hasMedia && MEDIA_TYPES.has(msg.type)) {
        await handleMediaMessage(msg, number, reply);
        return;
      }
      await handleTextMessage(msg, number, reply);
    } catch (err) {
      await handleError(err, number, reply);
    }
  });
}

async function handleMediaMessage(msg, number, reply) {
  if (!UPLOADABLE_TYPES.has(msg.type)) {
    await reply(
      "I can only print images and documents. Please send your file as a photo or a document."
    );
    return;
  }
  const media = await msg.downloadMedia();
  if (!media || !media.data) {
    await reply("I couldn't download that file. Please try sending it again.");
    return;
  }
  await handleMedia({ number, media, reply });
}

async function handleTextMessage(msg, number, reply) {
  const body = (msg.body || '').trim();

  if (!body.startsWith('/')) {
    await reply(
      "👋 Send me a file to print, or type */help* to see everything I can do."
    );
    return;
  }

  const withoutSlash = body.slice(1);
  const spaceIdx = withoutSlash.search(/\s/);
  const cmd = (spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx)).toLowerCase();
  const argStr = spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim();
  const args = argStr.length ? argStr.split(/\s+/) : [];

  const handler = commands[cmd];
  if (!handler) {
    await reply(`Unknown command */${cmd}*. Type */help* to see what I can do.`);
    return;
  }
  await handler({ number, args, argStr, reply });
}

async function handleError(err, number, reply) {
  if (err instanceof ApiError) {
    logger.warn(`API error for ${number}: ${err.message} (status ${err.status})`);
    await reply(`⚠️ ${err.message}`);
    return;
  }
  logger.error(`Unhandled error for ${number}:`, err);
  await reply('😞 Something went wrong on my end. Please try again in a moment.');
}

module.exports = { route };
