const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * Verifies a staff JWT and attaches the user payload to req.user.
 * Returns 401 if token is missing or invalid.
 */
const authenticateStaff = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.type !== 'staff') {
      return res.status(403).json({ error: 'Staff access required' });
    }
    req.user = payload;
    req.identity = { type: 'staff', id: payload.userId, label: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Verifies an anonymous session token from Authorization header.
 * Checks token exists and is not expired.
 * Attaches session info to req.anonSession.
 */
const authenticateAnonymous = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Session token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const [rows] = await pool.execute(
      `SELECT session_id, session_token, expires_at, captcha_verified
       FROM anonymoussessions
       WHERE session_token = ? AND captcha_verified = 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const session = rows[0];

    if (new Date() > new Date(session.expires_at)) {
      return res.status(401).json({ error: 'Session token has expired' });
    }

    req.anonSession = session;
    req.identity = { type: 'anonymous', id: session.session_id, label: 'ANONYMOUS' };
    next();
  } catch (err) {
    console.error('[AUTH] Anonymous session validation error:', err.message);
    return res.status(500).json({ error: 'Session validation failed' });
  }
};

/**
 * Middleware factory for role-based access control.
 * Usage: requireRole('Compliance_Officer', 'CEO')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Debug logging
    console.log('[DEBUG] requireRole check:', {
      requiredRoles: roles,
      userRole: req.user.role,
      username: req.user.username,
      matches: roles.includes(req.user.role)
    });
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
};

/**
 * Allows either authenticated staff OR anonymous session to proceed.
 * Attaches appropriate identity to req.identity.
 */
const authenticateAny = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  // Try staff JWT first
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.type === 'staff') {
      req.user = payload;
      req.identity = { type: 'staff', id: payload.userId, label: payload.username };
      return next();
    }
  } catch (_) {
    // Not a staff JWT — try anonymous session
  }

  // Try anonymous session
  try {
    const [rows] = await pool.execute(
      `SELECT session_id, session_token, expires_at
       FROM anonymoussessions
       WHERE session_token = ? AND captcha_verified = 1`,
      [token]
    );

    if (rows.length > 0 && new Date() < new Date(rows[0].expires_at)) {
      req.anonSession = rows[0];
      req.identity = { type: 'anonymous', id: rows[0].session_id, label: 'ANONYMOUS' };
      return next();
    }
  } catch (_) {}

  return res.status(401).json({ error: 'Invalid or expired authentication' });
};

module.exports = { authenticateStaff, authenticateAnonymous, requireRole, authenticateAny };
