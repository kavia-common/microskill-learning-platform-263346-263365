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

// Serve static assets at /assets for generated media
app.use('/assets', express.static(path.join(__dirname, '../../public/assets')));

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
