'use strict';

const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

/**
 * Build standard middleware stack for the API.
 * - CORS controlled by FRONTEND_ORIGIN env
 * - Security headers via helmet
 * - Gzip via compression
 * - Request logging via morgan
 * - Basic rate limiting (configurable via env)
 * - JSON body parser
 */
function buildMiddlewareStack(app, opts = {}) {
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
  const RATE_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const RATE_MAX = Number(process.env.RATE_LIMIT_MAX || 200);

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS
  app.use(cors({
    origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: FRONTEND_ORIGIN !== '*',
  }));

  // Trust proxies (for rate limit and logging behind proxies)
  app.set('trust proxy', 1);

  // Compression
  app.use(compression());

  // Logging
  const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));

  // Body parsing
  app.use(require('express').json({ limit: '1mb' }));

  // Rate limiting (skip on development if disabled)
  if (process.env.DISABLE_RATE_LIMIT !== 'true') {
    app.use('/api', rateLimit({
      windowMs: RATE_WINDOW_MS,
      max: RATE_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: { message: 'Too many requests, please try again later.' }
      }
    }));
  }
}

/**
 * Centralized error handler.
 * Ensures consistent error responses and hides sensitive details.
 */
// PUBLIC_INTERFACE
function errorHandler(err, req, res, _next) {
  /** Centralized error handler for the Express app. */
  const status = err.statusCode || err.status || 500;
  // Avoid logging huge bodies or secrets
  // eslint-disable-next-line no-console
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(status).json({
    error: {
      message: status >= 500 ? 'Server error' : (err.expose ? err.message : err.message || 'Request error'),
      code: err.code || undefined,
      details: process.env.NODE_ENV === 'development' ? (err.details || undefined) : undefined,
    }
  });
}

module.exports = {
  buildMiddlewareStack,
  errorHandler,
};
