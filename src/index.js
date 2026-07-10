'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const config = require('./config');
const logger = require('./logger');
const redis = require('./redis');
const { route } = require('./router');
const { startGateway } = require('./gateway');

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: config.wwebjsClientId,
    dataPath: config.wwebjsDataPath,
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  logger.info('Scan this QR code with WhatsApp (Linked Devices) to log in:');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => logger.info('WhatsApp authenticated'));

client.on('auth_failure', (msg) => {
  logger.error('WhatsApp auth failure:', msg);
});

client.on('ready', () => {
  logger.info(`ClickPrint bot is ready. Backend: ${config.apiUrl}`);
});

client.on('disconnected', (reason) => {
  logger.warn('WhatsApp disconnected:', reason);
});

client.on('message', (msg) => {
  logger.debug(`'message' event fired: from=${msg.from} type=${msg.type}`);
  route(msg).catch((err) => logger.error('Fatal route error:', err));
});

// Fallback diagnostics: if the 'message' event ever stops firing on a WhatsApp
// update, 'message_create' still fires for every message. We only act on it for
// inbound messages the 'message' event would have missed — but at minimum it
// tells us in the logs that messages are arriving.
client.on('message_create', (msg) => {
  if (!msg.fromMe) logger.debug(`'message_create' (inbound): from=${msg.from} type=${msg.type}`);
});

// HTTP gateway (NotifyBot `/send` API). Started once the client exists; message
// sends only succeed after the client is 'ready'.
const gatewayServer = startGateway(client);

async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down…`);
  try {
    await new Promise((resolve) => gatewayServer.close(resolve));
    logger.info('HTTP gateway closed');
  } catch (err) {
    logger.error('Error closing HTTP gateway:', err.message);
  }
  try {
    await client.destroy();
  } catch (err) {
    logger.error('Error destroying WhatsApp client:', err.message);
  }
  try {
    await redis.quit();
  } catch (err) {
    logger.error('Error closing Redis:', err.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

logger.info('Starting ClickPrint WhatsApp bot…');
client.initialize();
