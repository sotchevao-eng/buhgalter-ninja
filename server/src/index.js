'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');
const { migrate } = require('./migrate');
const { sendError, asyncHandler } = require('./http');
const routes = require('./routes');

function corsOrigin() {
  if (!config.CORS_ORIGIN) {
    if (config.isProduction) return false;
    return ['http://localhost:8080', 'http://127.0.0.1:8080'];
  }
  return config.CORS_ORIGIN.split(',').map((item) => item.trim()).filter(Boolean);
}

function limiter(max) {
  return rateLimit({
    windowMs: 60 * 1000,
    max: max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (req, res) {
      sendError(res, 429, 'RATE_LIMIT', 'too many requests');
    }
  });
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));
  app.use(cors({
    origin: corsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use(limiter(120));

  app.use(function (req, res, next) {
    if (!config.MAINTENANCE_MODE) return next();
    if (req.path === '/api/health') return next();
    return sendError(res, 503, 'MAINTENANCE', 'service is in maintenance');
  });

  app.get('/api/health', asyncHandler(async function (req, res) {
    if (config.MAINTENANCE_MODE) {
      return res.json({ status: 'maintenance' });
    }
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'error', db: false });
    }
  }));

  app.post('/api/v1/events', limiter(30), asyncHandler(async function (req, res) {
    const allowed = {
    game_open: true,
    game_start: true,
    game_over: true,
    share_click: true,
    community_click: true,
    leaderboard_open: true,
    daily_complete: true,
    tutorial_start: true,
    achievement_unlock: true,
    level_up: true
    };
    const name = String((req.body && req.body.name) || '');
    if (!allowed[name]) {
      return sendError(res, 400, 'INVALID_EVENT', 'unknown event');
    }
    if (!config.isProduction) {
      console.log('event', name, String((req.body && req.body.gameVersion) || ''));
    }
    res.json({ ok: true });
  }));

  app.use('/api/v1/auth', limiter(20));
  app.use('/api/v1/game/session', limiter(40));
  app.use('/api/v1', routes);

  app.use(function (req, res) {
    sendError(res, 404, 'NOT_FOUND', 'not found');
  });

  app.use(function (err, req, res, next) {
    console.error('server error', err && err.message);
    if (res.headersSent) return next(err);
    sendError(res, 500, 'SERVER_ERROR', 'internal error');
  });

  return app;
}

function startServer(app) {
  return new Promise(function (resolve, reject) {
    const server = app.listen(config.PORT, function () {
      console.log('accountant-ninja api on :' + config.PORT + ' env=' + config.NODE_ENV);
      resolve(server);
    });
    server.on('error', reject);
  });
}

function shutdown(server, signal) {
  console.log('shutdown', signal);
  const timer = setTimeout(function () {
    process.exit(1);
  }, 10000);
  server.close(function () {
    db.close().then(function () {
      clearTimeout(timer);
      process.exit(0);
    }).catch(function () {
      process.exit(1);
    });
  });
}

async function start() {
  if (!config.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  try {
    await migrate();
  } catch (err) {
    console.error('database connection / migration failed', err && err.message);
    process.exit(1);
  }
  const app = createApp();
  const server = await startServer(app);
  process.on('SIGTERM', function () { shutdown(server, 'SIGTERM'); });
  process.on('SIGINT', function () { shutdown(server, 'SIGINT'); });
  process.on('unhandledRejection', function (err) {
    console.error('unhandledRejection', err && err.message);
  });
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('failed to start', err && err.message);
    process.exit(1);
  });
}

module.exports = { createApp, start };
