const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

// Initialize express app
const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// CORS
app.use(cors({
  origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: FRONTEND_ORIGIN !== '*',
}));

app.set('trust proxy', true);

// Observability and perf
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Swagger (dynamic server)
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  const protocol = req.secure ? 'https' : req.protocol;
  const dynamicSpec = { ...swaggerSpec, servers: [{ url: `${protocol}://${host}` }] };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON request body
app.use(express.json({ limit: '1mb' }));

/**
 * Serve static assets at /assets for generated media with explicit MIME/CORS for media.
 * This secondary app.js also mirrors the behavior to ensure consistency if used.
 */
const ASSETS_ROOT = path.join(__dirname, '../../public/assets');

// Helper to set CORS for assets
function setAssetCors(res) {
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
  if (FRONTEND_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
}

// HEAD routes
app.head('/assets/video/mp4/:filename', (req, res) => {
  const file = req.params.filename || '';
  if (!/^[a-z0-9-_]+\.mp4$/i.test(file)) {
    setAssetCors(res);
    return res.status(400).end();
  }
  const p = path.join(ASSETS_ROOT, 'video/mp4', file);
  if (!require('fs').existsSync(p)) {
    setAssetCors(res);
    return res.status(404).end();
  }
  const stat = require('fs').statSync(p);
  setAssetCors(res);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  return res.status(200).end();
});

app.head('/assets/captions/:filename', (req, res) => {
  const file = req.params.filename || '';
  if (!/^[a-z0-9-_]+\.vtt$/i.test(file)) {
    setAssetCors(res);
    return res.status(400).end();
  }
  const p = path.join(ASSETS_ROOT, 'captions', file);
  if (!require('fs').existsSync(p)) {
    setAssetCors(res);
    return res.status(404).end();
  }
  const stat = require('fs').statSync(p);
  setAssetCors(res);
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  return res.status(200).end();
});

// GET routes for correct MIME
app.get('/assets/video/mp4/:filename', (req, res) => {
  const file = req.params.filename || '';
  const fs = require('fs');
  if (!/^[a-z0-9-_]+\.mp4$/i.test(file)) {
    setAssetCors(res);
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const p = path.join(ASSETS_ROOT, 'video/mp4', file);
  if (!fs.existsSync(p)) {
    setAssetCors(res);
    return res.status(404).json({ error: 'Not found' });
  }
  const stat = fs.statSync(p);
  setAssetCors(res);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  return res.sendFile(p);
});

app.get('/assets/captions/:filename', (req, res) => {
  const file = req.params.filename || '';
  const fs = require('fs');
  if (!/^[a-z0-9-_]+\.vtt$/i.test(file)) {
    setAssetCors(res);
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const p = path.join(ASSETS_ROOT, 'captions', file);
  if (!fs.existsSync(p)) {
    setAssetCors(res);
    return res.status(404).json({ error: 'Not found' });
  }
  const stat = fs.statSync(p);
  setAssetCors(res);
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  return res.sendFile(p);
});

// Fallback static for other files
app.use('/assets', express.static(ASSETS_ROOT));

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err?.message);
  res.status(err?.statusCode || 500).json({
    error: {
      message: err?.statusCode && err.statusCode < 500 ? err.message : 'Internal Server Error',
      code: err?.code || undefined
    }
  });
});

module.exports = app;
