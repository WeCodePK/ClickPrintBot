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

const digits = (jid) => (jid || '').split('@')[0].replace(/\D/g, '');

/**
 * Resolve the sender's real phone number.
 *
 * WhatsApp addresses some chats by a `@lid` (linked id) whose digits are NOT
 * the phone number. For those we use the LID<->PN mapping to get the phone-JID
 * (`pn`), falling back to the resolved contact's number. The result is cached
 * (see session.getCachedPhone) so this only round-trips WhatsApp once per user.
 */
async function resolvePhone(msg) {
  const from = msg.from || '';

  // Already a phone-number JID — the local part is the number.
  if (from.endsWith('@c.us')) return digits(from);

  // @lid: translate to the phone-number JID.
  try {
    const [mapping] = await msg.client.getContactLidAndPhone([from]);
    if (mapping && mapping.pn) return digits(mapping.pn);
  } catch (err) {
    logger.debug(`LID->PN resolution failed for ${from}: ${err.message}`);
  }

  // Fallback: the contact's number (available when it isn't hidden).
  try {
    const contact = await msg.getContact();
    if (contact && contact.number) return digits(contact.number);
  } catch (err) {
    logger.debug(`getContact failed for ${from}: ${err.message}`);
  }

  return null;
}

/** Resolve + cache the sender's phone number, keyed by the stable chat id. */
async function resolveNumber(msg) {
  const from = msg.from || '';
  const cached = await session.getCachedPhone(from);
  if (cached) return cached;

  const phone = await resolvePhone(msg);
  if (phone) await session.setCachedPhone(from, phone);
  return phone;
}

function isGroupOrBroadcast(from) {
  return from.endsWith('@g.us') || from.endsWith('@broadcast') || from === 'status@broadcast';
}

/**
 * NotifyBot-style helper: when the bot is @mentioned in a chat (typically a
 * group), reply with that chat's id so operators can grab the id to use with
 * the HTTP `/send` gateway. Returns true if it handled the message.
 */
async function handleMentionForChatId(msg) {
  try {
    const botId = msg.client?.info?.wid?._serialized;
    if (botId && msg.mentionedIds?.includes(botId)) {
      const chat = await msg.getChat();
      await msg.reply(`Chat ID: ${chat.id._serialized}`);
      return true;
    }
  } catch (err) {
    logger.error('Failed to handle mention:', err.message);
  }
  return false;
}

async function route(msg) {
  if (msg.fromMe) return;

  // Answer @mentions (incl. in groups) with the chat id before the group filter
  // drops group/broadcast traffic.
  if (await handleMentionForChatId(msg)) return;

  // Beyond mentions, only handle 1:1 user chats; skip groups/status broadcasts.
  const from = msg.from || '';
  if (isGroupOrBroadcast(from)) return;

  logger.info(`Incoming message from ${from} (type=${msg.type})`);

  const reply = makeReply(msg);

  const number = await resolveNumber(msg);
  if (!number) {
    logger.warn(`Could not resolve a phone number for ${from}.`);
    await reply(
      "Sorry, I couldn't read your WhatsApp number, so I can't look up your account. " +
        'This can happen if your number is hidden. Please try again later.'
    );
    return;
  }
  logger.info(`Resolved ${from} -> ${number}`);

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
