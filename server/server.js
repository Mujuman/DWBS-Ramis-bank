require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const { testConnection } = require('./config/db');
const routes = require('./routes/index');

const app = express();
const PORT = parseInt(process.env.PORT) || 5000;

// ── Security Headers ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── CORS (strict origin whitelist) ───────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false, // No cookies — JWT in Authorization header
}));

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── Global Rate Limiter ───────────────────────────────────────
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── PII-Masked Request Logger ─────────────────────────────────
// Custom format: logs method, URL (path only), status, response time
// NEVER logs request bodies, tokens, or user-identifiable data
const maskedMorgan = morgan((tokens, req, res) => {
  const url = tokens.url(req, res) || '';
  // Strip any query string that might contain sensitive data
  const cleanUrl = url.split('?')[0];
  return [
    tokens.method(req, res),
    cleanUrl,
    tokens.status(req, res),
    tokens['response-time'](req, res), 'ms',
  ].join(' ');
});
app.use(maskedMorgan);

// ── Body Parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── API Routes ────────────────────────────────────────────────
app.use('/api', routes);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DWBS API',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Never expose stack traces in production
  const isDev = process.env.NODE_ENV === 'development';
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'An internal server error occurred',
  });
});

// ── Start Server ──────────────────────────────────────────────
const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`[SERVER] DWBS API running on port ${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Client origin: ${process.env.CLIENT_ORIGIN}`);
  });
};

start();

module.exports = app;
