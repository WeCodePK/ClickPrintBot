'use strict';

const express = require('express');
const config = require('./config');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// HTTP gateway — the NotifyBot `/send` API folded into ClickPrintBot.
//
// Exposes a small Express server so external services can push WhatsApp
// messages through this bot's already-authenticated client. Every response
// uses the same { success, message, data } shape NotifyBot used so existing
// callers keep working unchanged.
// ---------------------------------------------------------------------------

function resp(res, code, message, data = {}) {
  return res.status(code).json({
    success: code >= 200 && code <= 299,
    message,
    data,
  });
}

/** Reject requests whose `apiKey` doesn't match the configured API_KEY. */
function apiKeyMiddleware(req, res, next) {
  const apiKey = req.body?.apiKey ?? req.query?.apiKey;

  if (!apiKey) {
    return resp(res, 400, 'Missing apiKey');
  }
  if (!config.apiKey || apiKey !== config.apiKey) {
    return resp(res, 401, 'Invalid apiKey');
  }
  next();
}

/**
 * Start the HTTP gateway.
 *
 * @param {import('whatsapp-web.js').Client} client - the live WhatsApp client.
 * @returns {import('http').Server} the listening server (for graceful shutdown).
 */
function startGateway(client) {
  const app = express();
  app.use(express.json());

  // Lightweight liveness probe (no auth) for load balancers / compose healthchecks.
  app.get('/health', (req, res) => resp(res, 200, 'ok'));

  app.post('/send', apiKeyMiddleware, async (req, res) => {
    const chatId = req.body?.chatId ?? req.query?.chatId;
    const message = req.body?.message ?? req.query?.message;

    if (!chatId || !message) {
      return resp(res, 400, 'Missing or empty fields (chatId, message)');
    }

    try {
      await client.sendMessage(chatId, message);
      return resp(res, 200, 'Sent message successfully');
    } catch (err) {
      logger.error('Failed to send message via /send:', err.message);
      return resp(res, 500, 'Failed to send message');
    }
  });

  const server = app.listen(config.gatewayPort, () => {
    logger.info(`HTTP gateway listening on port ${config.gatewayPort}`);
  });

  if (!config.apiKey) {
    logger.warn(
      'API_KEY is not set — the /send gateway will reject every request. ' +
        'Set API_KEY to enable outbound message sending.'
    );
  }

  return server;
}

module.exports = { startGateway };
