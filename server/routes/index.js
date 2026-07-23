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
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  caseController.listCases
);

// Get single case
router.get('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  caseController.getCaseById
);

// Update authenticated staff request details
router.patch('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  caseController.editCase
);

// Soft delete authenticated staff request
router.delete('/cases/:id',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  caseController.deleteCase
);

// Update case status/assignment
router.patch('/cases/:id/status',
  authenticateStaff,
  requireRole('Compliance_Officer', 'CEO'),
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

// ── EAAC Report to CEO ────────────────────────────────────────
// POST /api/cases/:id/reports
// Ethics & Anti-Corruption sends a formal report (subject + body + optional file) to CEO.
router.post('/cases/:id/reports',
  authenticateStaff,
  requireRole('Compliance_Officer'),
  upload.single('file'),
  handleUploadErrors,
  processAndSaveFile,
  async (req, res) => {
    const { pool } = require('../config/db');
    const { writeAuditLog } = require('../services/auditService');
    const { createNotification } = require('../controllers/notificationController');
    const emailService = require('../services/emailService');
    const caseId = parseInt(req.params.id);
    const { subject, body } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Report subject is required' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Report body is required' });
    }

    try {
      // Verify case exists
      const [caseRows] = await pool.execute(
        `SELECT case_id, reference_id, category, is_escalated FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
        [caseId]
      );
      if (caseRows.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }
      const caseData = caseRows[0];

      // Save attached file as evidence if provided
      let attachedFile = null;
      if (req.file) {
        const fileName = req.processedFile?.originalFilename || req.file.originalname;
        const filePath = req.processedFile?.storedFilename || req.file.filename;
        const encryptionIv = req.processedFile?.encryptionIv || null;
        const mimeType = req.processedFile?.mimeType || req.file.mimetype || 'application/octet-stream';

        // Check if mime_type column exists
        const [cols] = await pool.execute("SHOW COLUMNS FROM evidencefiles LIKE 'mime_type'");
        if (cols.length > 0) {
          await pool.execute(
            `INSERT INTO evidencefiles (case_id, file_name, file_path, encryption_iv, uploaded_by, mime_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [caseId, fileName, filePath, encryptionIv, req.user.userId, mimeType]
          );
        } else {
          await pool.execute(
            `INSERT INTO evidencefiles (case_id, file_name, file_path, encryption_iv, uploaded_by)
             VALUES (?, ?, ?, ?, ?)`,
            [caseId, fileName, filePath, encryptionIv, req.user.userId]
          );
        }
        const [[inserted]] = await pool.execute(
          `SELECT file_id FROM evidencefiles WHERE case_id = ? ORDER BY uploaded_at DESC LIMIT 1`,
          [caseId]
        );
        attachedFile = { id: inserted.file_id, name: fileName, mime_type: mimeType };
      }

      // Save the report as a CEO-directed note with subject prefix
      const noteBody = `**${subject.trim()}**\n\n${body.trim()}${attachedFile ? `\n\n📎 Attached: ${attachedFile.name}` : ''}`;
      await pool.execute(
        `INSERT INTO investigationnotes (case_id, sender_type, audience_type, note_text, is_internal_only)
         VALUES (?, 'Compliance_Officer', 'CEO', ?, 0)`,
        [caseId, noteBody]
      );

      // Escalate the case if not already escalated
      if (!caseData.is_escalated) {
        await pool.execute(
          `UPDATE cases SET is_escalated = 1, updated_at = NOW() WHERE case_id = ?`,
          [caseId]
        );
      }

      // Notify CEO
      createNotification({
        targetRole: 'CEO',
        type: 'new_message',
        title: `EAAC Report: ${subject.trim()}`,
        message: `The Ethics & Anti-Corruption Office has sent you a report on case ${caseData.reference_id}.`,
        caseId,
      });

      // Email CEO
      try {
        const [ceoRows] = await pool.execute(
          `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
        );
        if (ceoRows.length > 0) {
          emailService.notifyCEOEscalation(ceoRows[0].email, {
            reference_id: caseData.reference_id,
            category: caseData.category,
            subject: subject.trim(),
          }).catch(() => {});
        }
      } catch (_) {}

      await writeAuditLog({
        userId: req.user.userId,
        caseId,
        action: 'EAAC_REPORT_SENT',
        performedBy: req.user.username,
        performedByType: 'staff',
        metadata: { subject: subject.trim(), has_attachment: !!attachedFile, reference_id: caseData.reference_id },
      });

      return res.status(201).json({
        message: 'Report sent to CEO successfully',
        attached_file: attachedFile,
      });
    } catch (err) {
      console.error('[REPORT] Send error:', err.message);
      return res.status(500).json({ error: 'Failed to send report' });
    }
  }
);

// Request Branch Manager Help (Compliance Officer only)
router.post('/cases/:id/request-manager-help',
  authenticateStaff,
  requireRole('Compliance_Officer'),
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
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  upload.single('file'),
  handleUploadErrors,
  processAndSaveFile,
  evidenceController.uploadEvidence
);

router.get('/cases/:id/evidence',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  evidenceController.listEvidence
);

router.get('/cases/:id/evidence/:fileId/download',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
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
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  noteController.createNote
);

router.get('/cases/:id/notes',
  authenticateStaff,
  requireRole('Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO'),
  noteController.getNotes
);

// Edit own note (CEO, Compliance_Officer only)
router.patch('/cases/:id/notes/:noteId',
  authenticateStaff,
  requireRole('Compliance_Officer', 'CEO'),
  sanitizeRequestBody,
  noteController.updateNote
);

// Delete own note (CEO, Compliance_Officer only)
router.delete('/cases/:id/notes/:noteId',
  authenticateStaff,
  requireRole('Compliance_Officer', 'CEO'),
  noteController.deleteNote
);

// ── Users Routes (admin) ──────────────────────────────────────

router.get('/users',
  authenticateStaff,
  requireRole('System_Admin', 'Compliance_Officer', 'CEO'),
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
    const validRoles = ['Employee', 'Branch_Manager', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'];
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

// Update user details (username, email, department)
router.patch('/users/:id',
  sanitizeRequestBody,
  authenticateStaff,
  requireRole('System_Admin'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const { writeAuditLog } = require('../services/auditService');
    const userId = parseInt(req.params.id);
    const { username, email, department } = req.body;

    if (!username && !email && !department) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    try {
      // Check user exists
      const [existing] = await pool.execute(
        `SELECT user_id FROM users WHERE user_id = ?`, [userId]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check uniqueness of username/email if changing
      if (username || email) {
        const [conflict] = await pool.execute(
          `SELECT user_id FROM users WHERE (username = ? OR email = ?) AND user_id != ?`,
          [username || '', email || '', userId]
        );
        if (conflict.length > 0) {
          return res.status(409).json({ error: 'Username or email already in use' });
        }
      }

      const updates = [];
      const params = [];
      if (username) { updates.push('username = ?'); params.push(username.trim()); }
      if (email)    { updates.push('email = ?');    params.push(email.trim()); }
      if (department) { updates.push('department = ?'); params.push(department.trim()); }
      params.push(userId);

      await pool.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params
      );

      await writeAuditLog({
        userId: req.user.userId,
        action: 'USER_UPDATED',
        performedBy: req.user.username,
        performedByType: 'staff',
        metadata: { target_user_id: userId, updated_fields: updates.map(u => u.split('=')[0].trim()) },
      });

      res.json({ message: 'User updated successfully' });
    } catch (err) {
      console.error('[ADMIN] User update error:', err.message);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Hard delete a user account (System Admin only)
router.delete('/users/:id',
  authenticateStaff,
  requireRole('System_Admin'),
  async (req, res) => {
    const { pool } = require('../config/db');
    const { writeAuditLog } = require('../services/auditService');
    const userId = parseInt(req.params.id);

    // Prevent self-deletion
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    try {
      const [existing] = await pool.execute(
        `SELECT user_id, username, role FROM users WHERE user_id = ?`, [userId]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      await pool.execute(`DELETE FROM users WHERE user_id = ?`, [userId]);

      await writeAuditLog({
        userId: req.user.userId,
        action: 'USER_DELETED',
        performedBy: req.user.username,
        performedByType: 'staff',
        metadata: { deleted_user_id: userId, deleted_username: existing[0].username, deleted_role: existing[0].role },
      });

      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      console.error('[ADMIN] User delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
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
