const cors = require('cors');
const morgan = require('morgan');
const express = require('express');

// -------------------------------------------------------------------------- //

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// -------------------------------------------------------------------------- //

app.use(express.json({
  verify: (req, res, buf) => req.rawBody = buf
}));

app.use(morgan('combined', {
  skip: (req, res) => req.path === '/health'
}));

app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// -------------------------------------------------------------------------- //

const required = [
  'SERVICE_KEY',
];

process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

for (const v of required) {
  if (!process.env[v]) {
    console.error(`[ERROR] ${v} environment variable is required`);
    process.exit(1);
  }
}

// -------------------------------------------------------------------------- //

app.get('/health', async (req, res) => {
    res.sendStatus(200);
});

// -------------------------------------------------------------------------- //



// -------------------------------------------------------------------------- //

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).send('Internal Server Error');
});

// -------------------------------------------------------------------------- //

const server = app.listen(process.env.PORT || 3000, () => {
  console.log('[INFO] Server listening on port', process.env.PORT || 3000);
});

// -------------------------------------------------------------------------- //

const gracefulShutdown = async (server) => {
  try {
    console.log('[INFO] Attempting to gracefully shut down server');

    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    console.log('[INFO] Successfully shutdown server');
    process.exit(0);

  } catch (err) {
    console.error('[ERROR] Error during server shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown(server));
process.on('SIGTERM', () => gracefulShutdown(server));