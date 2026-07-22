const express = require('express');
const router = express.Router();

const { authenticateStaff, authenticateAnonymous, requireRole, authenticateAny } = require('../middleware/auth');
const { sanitizeRequestBody, handleValidationErrors,
        validateAnonSession, validateLogin, validateCreateUser, validateResetPassword, validateCreateCase,
        validateStatusUpdate, validateCreateNote, validateTrackCase,
        validateEditCaseAnonymous, validateDeleteCaseAnonymous, validateCreateAnonNote } = require('../middleware/sanitize');
const { upload, processAndSaveFile, handleUploadErrors } = require('../middleware/upload');

const authController = require('../controllers/authController');
const caseController = require('../controllers/caseController');
const evidenceController = require('../controllers/evidenceController');
const noteController = require('../controllers/noteController');
const notificationController = require('../controllers/notificationController');

// ── Auth Routes ───────────────────────────────────────────────
router.post('/auth/anonymous',
  sanitizeRequestBody,
  validateAnonSession,
  handleValidationErrors,
  authController.initAnonymousSession
);

router.post('/auth/login',
  sanitizeRequestBody,
  validateLogin,
  handleValidationErrors,
  authController.staffLogin
);

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

// Anonymous edit case (no auth header needed, verified by reference_id + verification_token)
router.patch('/cases/anonymous',
  sanitizeRequestBody,
  validateEditCaseAnonymous,
  handleValidationErrors,
  caseController.editCaseAnonymous
);

// Anonymous delete case (no auth header needed, verified by reference_id + verification_token)
router.delete('/cases/anonymous',
  sanitizeRequestBody,
  validateDeleteCaseAnonymous,
  handleValidationErrors,
  caseController.deleteCaseAnonymous
);

// Anonymous get full case details (requires reference_id + verification_token)
router.get('/cases/anonymous',
  caseController.getAnonymousCaseDetails
);

// Executive stats (CEO, Compliance_Officer)
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
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  caseController.listCases
);

// Get single case
router.get('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  caseController.getCaseById
);

// Update authenticated staff request details
router.patch('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  caseController.editCase
);

// Soft delete authenticated staff request
router.delete('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  caseController.deleteCase
);

// Update case status/assignment
// CEO is included so they can assign investigators on escalated cases
router.patch('/cases/:id/status',
  authenticateStaff,
  requireRole('Investigator', 'Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  validateStatusUpdate,
  handleValidationErrors,
  caseController.updateCaseStatus
);

// Escalate case manually (Compliance Officer only)
router.post('/cases/:id/escalate',
  authenticateStaff,
  requireRole('Compliance_Officer'),
  caseController.escalateCase
);

// Request Branch Manager Help (Investigator or Compliance Officer)
router.post('/cases/:id/request-manager-help',
  authenticateStaff,
  requireRole('Investigator', 'Compliance_Officer'),
  sanitizeRequestBody,
  caseController.requestManagerHelp
);

// ── Evidence Routes ───────────────────────────────────────────

router.post('/cases/anonymous/evidence',
  upload.single('file'),
  handleUploadErrors,
  processAndSaveFile,
  evidenceController.uploadAnonymousEvidence
);

router.get('/cases/anonymous/evidence',
  evidenceController.listAnonymousEvidence
);

router.get('/cases/anonymous/evidence/:fileId/download',
  evidenceController.downloadAnonymousEvidence
);

router.delete('/cases/anonymous/evidence/:fileId',
  sanitizeRequestBody,
  evidenceController.deleteAnonymousEvidence
);

router.post('/cases/:id/evidence',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  upload.single('file'),
  handleUploadErrors,
  processAndSaveFile,
  evidenceController.uploadEvidence
);

router.get('/cases/:id/evidence',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  evidenceController.listEvidence
);

router.get('/cases/:id/evidence/:fileId/download',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  evidenceController.downloadEvidence
);

// ── Note Routes ───────────────────────────────────────────────

router.post('/cases/anonymous/notes',
  sanitizeRequestBody,
  validateCreateAnonNote,
  handleValidationErrors,
  noteController.createAnonNote
);

router.post('/cases/:id/notes',
  sanitizeRequestBody,
  validateCreateNote,
  handleValidationErrors,
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
  noteController.createNote
);

router.get('/cases/:id/notes',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO'),
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

router.post('/users',
  sanitizeRequestBody,
  validateCreateUser,
  handleValidationErrors,
  authenticateStaff,
  requireRole('System_Admin'),
  authController.registerUser
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

router.patch('/users/:id/password',
  sanitizeRequestBody,
  validateResetPassword,
  handleValidationErrors,
  authenticateStaff,
  requireRole('System_Admin'),
  authController.resetUserPassword
);

// ── Audit Log Route ───────────────────────────────────────────

router.get('/audit',
  authenticateStaff,
  requireRole('System_Admin', 'CEO', 'Auditor'),
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

    // Sanitize metadata by parsing JSON and stripping ip_hash and user_agent
    const sanitizedLogs = logs.map(log => {
      let meta = {};
      try {
        meta = JSON.parse(log.metadata);
      } catch (e) {
        meta = typeof log.metadata === 'object' ? log.metadata : {};
      }
      if (meta) {
        delete meta.ip_hash;
        delete meta.user_agent;
      }
      return {
        ...log,
        metadata: JSON.stringify(meta),
      };
    });
    
    const [[count]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM AuditLogs ${whereClause}`,
      params
    );
    
    res.json({ logs: sanitizedLogs, pagination: { total: count.total, page, limit } });
  });

// ── Notification Routes ──────────────────────────────────────

router.get('/notifications',
  authenticateStaff,
  notificationController.getNotifications
);

router.get('/notifications/count',
  authenticateStaff,
  notificationController.getUnreadCount
);

router.patch('/notifications/read-all',
  authenticateStaff,
  notificationController.markAllAsRead
);

router.patch('/notifications/:id/read',
  authenticateStaff,
  notificationController.markAsRead
);

module.exports = router;
