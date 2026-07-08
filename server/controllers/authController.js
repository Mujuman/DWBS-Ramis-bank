const jwt = require('jsonwebtoken');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticateUser } = require('../config/ldap');
const { generateSecureToken, getSessionExpiry } = require('../utils/tokenUtils');
const { writeAuditLog } = require('../services/auditService');

// ── Anonymous Session Init ────────────────────────────────────

/**
 * POST /api/auth/anonymous
 * Validates hCaptcha, creates a 30-minute anonymous session token.
 * STRICT: No IP address stored. No browser fingerprint.
 */
const initAnonymousSession = async (req, res) => {
  const { captcha_token } = req.body;

  try {
    // Always verify hCaptcha; no dev bypass allowed in production-ready build
    const captchaRes = await axios.post(
      process.env.HCAPTCHA_VERIFY_URL || 'https://hcaptcha.com/siteverify',
      new URLSearchParams({
        secret:   process.env.HCAPTCHA_SECRET,
        response: captcha_token,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Log verification response for debugging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.debug('[AUTH] hCaptcha verification response:', captchaRes.data);
    }

    if (!captchaRes.data.success) {
      const errCodes = captchaRes.data['error-codes'] || captchaRes.data['errors'] || [];
      console.warn('[AUTH] CAPTCHA failed validation:', errCodes);
      return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.', codes: errCodes });
    }
  } catch (captchaErr) {
    console.error('[AUTH] CAPTCHA verification error:', captchaErr.message);
    return res.status(503).json({ error: 'CAPTCHA service unavailable. Please try again.' });
  }

  try {
    const sessionToken = generateSecureToken(48); // 96-char hex string
    const expiresAt = getSessionExpiry();

    await pool.execute(
      `INSERT INTO anonymoussessions (session_token, captcha_verified, expires_at)
       VALUES (?, 1, ?)`,
      [sessionToken, expiresAt]
    );

    // Audit: No IP stored, no PII
    await writeAuditLog({
      caseId: null,
      action: 'ANONYMOUS_SESSION_CREATED',
      performedBy: null,
      performedByType: 'anonymous',
      metadata: { expires_at: expiresAt.toISOString() },
    });

    return res.status(201).json({
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      message: 'Anonymous session created. Your identity is fully protected.',
    });
  } catch (err) {
    console.error('[AUTH] Session creation error:', err.message);
    return res.status(500).json({ error: 'Failed to create session' });
  }
};

// ── Staff Login (LDAP) ────────────────────────────────────────

/**
 * POST /api/auth/login
 * Authenticates corporate staff via Active Directory LDAP bind.
 * Maps AD group membership to RBAC roles.
 * Returns short-lived JWT access token + refresh token.
 */
const staffLogin = async (req, res) => {
  const { username, password, otp } = req.body;

  try {
    const otpEnabled = Boolean(process.env.OTP_CODE || process.env.OTP_SECRET);
    if (otpEnabled) {
      if (!otp || String(otp).trim() === '') {
        return res.status(400).json({ error: 'OTP is required when OTP validation is enabled.' });
      }
      const expectedOtp = process.env.OTP_CODE || process.env.OTP_SECRET;
      if (String(otp).trim() !== expectedOtp) {
        await writeAuditLog({
          action: 'STAFF_LOGIN_FAILED',
          performedBy: null,
          performedByType: 'system',
          metadata: { reason: 'Invalid OTP' },
        });
        return res.status(401).json({ error: 'Invalid OTP' });
      }
    }
    // ── Step 1: Look up user in local DB ──────────────────────
    const [rows] = await pool.execute(
      `SELECT user_id, username, email, role, department, is_active, password_hash
       FROM users WHERE username = ?`,
      [username]
    );

    // ── Step 2: Local password fallback (sysadmin / pre-AD setup) ──
    // If the account has a password_hash stored, authenticate locally
    // without touching Active Directory.
    if (rows.length > 0 && rows[0].password_hash) {
      const dbUser = rows[0];

      if (!dbUser.is_active) {
        return res.status(403).json({ error: 'Your account has been deactivated. Contact IT.' });
      }

      const match = await bcrypt.compare(password, dbUser.password_hash);
      if (!match) {
        await writeAuditLog({
          action: 'STAFF_LOGIN_FAILED',
          performedBy: null,
          performedByType: 'system',
          metadata: { reason: 'Invalid local password' },
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await writeAuditLog({
        action: 'STAFF_LOGIN_SUCCESS',
        performedBy: dbUser.user_id,
        performedByType: 'staff',
        metadata: { role: dbUser.role, method: 'local' },
      });

      return issueTokens(res, dbUser);
    }

    // ── Step 3: Active Directory authentication ───────────────
    let adUser;
    try {
      adUser = await authenticateUser(username, password);
    } catch (ldapErr) {
      await writeAuditLog({
        action: 'STAFF_LOGIN_FAILED',
        performedBy: null,
        performedByType: 'system',
        metadata: { reason: 'LDAP authentication failed' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Auto-provision AD user on first login if not in local DB
    let dbUser;
    if (rows.length === 0) {
      const department = adUser.department || 'General';
      const [result] = await pool.execute(
        `INSERT INTO users (username, email, role, department, is_active)
         VALUES (?, ?, 'Employee', ?, 1)`,
        [adUser.sAMAccountName, adUser.mail || `${adUser.sAMAccountName}@rammisbank.et`, department]
      );
      dbUser = {
        user_id: result.insertId,
        username: adUser.sAMAccountName,
        email: adUser.mail || `${adUser.sAMAccountName}@rammisbank.et`,
        role: 'Employee',
        department,
        is_active: 1,
      };
    } else {
      dbUser = rows[0];
    }

    if (!dbUser.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact IT.' });
    }

    await writeAuditLog({
      action: 'STAFF_LOGIN_SUCCESS',
      performedBy: dbUser.user_id,
      performedByType: 'staff',
      metadata: { role: dbUser.role, method: 'ldap' },
    });

    return issueTokens(res, dbUser);

  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    return res.status(500).json({ error: 'Authentication service error' });
  }
};

// ── Helper: sign & return JWT pair ───────────────────────────
const issueTokens = (res, dbUser) => {
  const accessToken = jwt.sign(
    {
      type: 'staff',
      userId: dbUser.user_id,
      username: dbUser.username,
      displayName: dbUser.username,
      role: dbUser.role,
      department: dbUser.department,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );

  const refreshToken = jwt.sign(
    { type: 'refresh', userId: dbUser.user_id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return res.status(200).json({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900,
    user: {
      id: dbUser.user_id,
      username: dbUser.username,
      display_name: dbUser.username,
      role: dbUser.role,
      department: dbUser.department,
    },
  });
};

// ── Token Refresh ─────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Validates refresh token and issues a new access token.
 */
const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const [rows] = await pool.execute(
      `SELECT user_id, username, email, role, department, is_active FROM users WHERE user_id = ?`,
      [payload.userId]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = rows[0];
    const newAccessToken = jwt.sign(
      { type: 'staff', userId: user.user_id, username: user.username, displayName: user.username, role: user.role, department: user.department },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    return res.status(200).json({ access_token: newAccessToken, expires_in: 900 });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

/**
 * GET /api/auth/me
 * Returns current authenticated user info.
 */
const getMe = async (req, res) => {
  return res.status(200).json({ user: req.user });
};

/**
 * POST /api/auth/register (DEV ONLY)
 * Registers a new user account for testing purposes.
 * In production, users should be managed via LDAP or by System Admins.
 */
const registerUser = async (req, res) => {
  const { username, email, password, role, department } = req.body;

  if (!username || !email || !password || !role || !department) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validRoles = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Check if username or email already exists
    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Insert new user
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, role, department, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username, email, password_hash, role, department]
    );

    await writeAuditLog({
      action: 'USER_REGISTERED',
      performedBy: result.insertId,
      performedByType: 'system',
      metadata: { username, role, department, method: 'dev_registration' },
    });

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: result.insertId,
        username,
        email,
        role,
        department,
      },
    });
  } catch (err) {
    console.error('[AUTH] Registration error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

module.exports = { initAnonymousSession, staffLogin, refreshToken, getMe, registerUser };
