const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { authenticateStaff, authenticateAnonymous, requireRole, authenticateAny } = require('../middleware/auth');
const { sanitizeRequestBody, handleValidationErrors,
        validateAnonSession, validateLogin, validateCreateCase,
        validateStatusUpdate, validateCreateNote, validateTrackCase } = require('../middleware/sanitize');
const { upload, processAndSaveFile, handleUploadErrors } = require('../middleware/upload');

const authController = require('../controllers/authController');
const caseController = require('../controllers/caseController');
const evidenceController = require('../controllers/evidenceController');
const noteController = require('../controllers/noteController');

// ── Strict rate limiter for auth endpoints ────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.STRICT_RATE_LIMIT_MAX) || 10,
  message: { error: 'Too many attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Auth Routes ───────────────────────────────────────────────
router.post('/auth/anonymous',
  authLimiter,
  sanitizeRequestBody,
  validateAnonSession,
  handleValidationErrors,
  authController.initAnonymousSession
);

router.post('/auth/login',
  authLimiter,
  sanitizeRequestBody,
  validateLogin,
  handleValidationErrors,
  authController.staffLogin
);

// Development-only registration endpoint
if (process.env.NODE_ENV === 'development') {
  router.post('/auth/register',
    authLimiter,
    sanitizeRequestBody,
    authController.registerUser
  );
}

router.post('/auth/refresh',
  sanitizeRequestBody,
  authController.refreshToken
);

router.get('/auth/me',
  authenticateStaff,
  authController.getMe
);

// ── Case Routes ───────────────────────────────────────────────

// Public track route (no auth, just reference_id)
router.get('/cases/track',
  validateTrackCase,
  handleValidationErrors,
  caseController.trackCase
);

// Executive stats (CEO, Compliance_Officer, System_Admin)
router.get('/cases/stats',
  authenticateStaff,
  requireRole('CEO', 'Compliance_Officer', 'System_Admin'),
  caseController.getCaseStats
);

// Create case (anonymous OR staff)
router.post('/cases',
  sanitizeRequestBody,
  validateCreateCase,
  handleValidationErrors,
  authenticateAny,
  caseController.createCase
);

// List cases (staff only, role-filtered)
router.get('/cases',
  authenticateStaff,
  caseController.listCases
);

// Get single case
router.get('/cases/:id',
  authenticateStaff,
  caseController.getCaseById
);

// Update case status/assignment
router.patch('/cases/:id/status',
  authenticateStaff,
  requireRole('Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'),
  sanitizeRequestBody,
  validateStatusUpdate,
  handleValidationErrors,
  caseController.updateCaseStatus
);

// ── Evidence Routes ───────────────────────────────────────────

router.post('/cases/:id/evidence',
  authenticateAny,
  upload.single('file'),
  handleUploadErrors,
  processAndSaveFile,
  evidenceController.uploadEvidence
);

router.get('/cases/:id/evidence',
  authenticateStaff,
  requireRole('Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'),
  evidenceController.listEvidence
);

router.get('/cases/:id/evidence/:fileId/download',
  authenticateStaff,
  requireRole('Investigator', 'Compliance_Officer', 'System_Admin'),
  evidenceController.downloadEvidence
);

// ── Note Routes ───────────────────────────────────────────────

router.post('/cases/:id/notes',
  sanitizeRequestBody,
  validateCreateNote,
  handleValidationErrors,
  authenticateAny,
  noteController.createNote
);

router.get('/cases/:id/notes',
  authenticateAny,
  noteController.getNotes
);

// ── Users Routes (admin) ──────────────────────────────────────

router.get('/users',
  authenticateStaff,
  requireRole('System_Admin', 'Compliance_Officer'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const [users] = await pool.execute(
      `SELECT user_id as id, username, email, role, department, is_active, created_at
       FROM Users ORDER BY created_at DESC`
    );
    res.json({ users });
  }
);

router.patch('/users/:id/role',
  authenticateStaff,
  requireRole('System_Admin'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const { role } = req.body;
    const validRoles = ['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
    if (!validRoles.includes(role)) {
      return res.status(422).json({ error: 'Invalid role' });
    }
    await pool.execute(`UPDATE Users SET role = ? WHERE user_id = ?`, [role, req.params.id]);
    res.json({ message: 'Role updated' });
  }
);

router.patch('/users/:id/active',
  authenticateStaff,
  requireRole('System_Admin'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const { is_active } = req.body;
    await pool.execute(`UPDATE Users SET is_active = ? WHERE user_id = ?`, [is_active ? 1 : 0, req.params.id]);
    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'}` });
  }
);

// ── Audit Log Route ───────────────────────────────────────────

router.get('/audit',
  authenticateStaff,
  requireRole('System_Admin', 'Compliance_Officer', 'CEO', 'Auditor'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    // Build filter conditions
    const filters = [];
    const params = [];
    
    if (req.query.action) {
      filters.push('action LIKE ?');
      params.push(`%${req.query.action}%`);
    }
    
    if (req.query.case_id) {
      filters.push('target_case_id = ?');
      params.push(parseInt(req.query.case_id));
    }
    
    if (req.query.user_id) {
      filters.push('user_id = ?');
      params.push(parseInt(req.query.user_id));
    }
    
    if (req.query.from_date) {
      filters.push('timestamp >= ?');
      params.push(req.query.from_date);
    }
    
    if (req.query.to_date) {
      filters.push('timestamp <= ?');
      params.push(req.query.to_date);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    
    const [logs] = await pool.execute(
      `SELECT log_id as id, target_case_id, action, user_id as performed_by, 
              'staff' as performed_by_type, details as metadata, timestamp as created_at
       FROM AuditLogs ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM AuditLogs ${whereClause}`,
      params
    );
    
    res.json({ logs, pagination: { total: count.total, page, limit } });
  }
);

module.exports = router;
