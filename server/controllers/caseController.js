const { pool } = require('../config/db');
const { generateReferenceId, generateSecureToken } = require('../utils/tokenUtils');
const { writeAuditLog } = require('../services/auditService');
const emailService = require('../services/emailService');
const { createNotification } = require('./notificationController');

// ── Severity Classification Matrix ────────────────────────────
// Maps case category to initial automatic severity level
const CATEGORY_SEVERITY_MAP = {
  'Fraud': 'High',
  'Corruption': 'Critical',
  'Bribery': 'Critical',
  'Abuse_of_Power': 'High',
  'Procurement_Violation': 'Medium',
  'System_Misuse': 'Medium',
};

const INVESTIGATOR_STATUSES = ['Under_Review', 'Investigating', 'Pending_Evidence', 'Resolved', 'Closed'];
const COMPLIANCE_OFFICER_STATUSES = ['New', 'Assigned'];

const getInitialSeverity = (category) => {
  return CATEGORY_SEVERITY_MAP[category] || 'Medium';
};

// ── Create Case ───────────────────────────────────────────────

/**
 * POST /api/cases
 * Accepts submissions from both anonymous sessions and staff.
 * Generates a random, non-sequential reference_id as the public handle.
 */
const createCase = async (req, res) => {
  const { category, description, severity_level, branch_or_dept } = req.body;
  const identity = req.identity;

  try {
    // Generate unique reference_id with collision check
    let referenceId;
    let isUnique = false;
    while (!isUnique) {
      referenceId = generateReferenceId(12);
      const [existing] = await pool.execute(
        `SELECT case_id FROM cases WHERE reference_id = ?`,
        [referenceId]
      );
      if (existing.length === 0) isUnique = true;
    }

    const reporterType = identity.type === 'staff' ? 'Authenticated' : 'Anonymous';
    const userId = identity.type === 'staff' ? identity.id : null;
    const verificationToken = generateSecureToken(32);
    
    // Automatic severity classification based on category
    const initialSeverity = getInitialSeverity(category);
    const isEscalated = initialSeverity === 'Critical';

    const [result] = await pool.execute(
      `INSERT INTO cases
        (reference_id, verification_token, reporter_type, user_id, category,
         branch_or_dept, severity_level, description, status, is_escalated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', ?)`,
      [
        referenceId,
        verificationToken,
        reporterType,
        userId,
        category,
        branch_or_dept || 'General',
        initialSeverity,
        description,
        isEscalated ? 1 : 0,
      ]
    );

    const caseId = result.insertId;

    // Write audit log
    await writeAuditLog({
      userId,
      caseId,
      action: 'CASE_CREATED',
      metadata: { 
        category, 
        initial_severity: initialSeverity, 
        auto_classified: true,
        escalated: isEscalated,
        status: 'New' 
      },
    });

    // If Critical, notify CEO immediately
    if (isEscalated) {
      try {
        const [ceoRows] = await pool.execute(
          `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
        );
        if (ceoRows.length > 0) {
          emailService.notifyCEOEscalation(ceoRows[0].email, {
            reference_id: referenceId,
            category,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    // Notify compliance team
    try {
      const [compRows] = await pool.execute(
        `SELECT email FROM users WHERE role = 'Compliance_Officer' AND is_active = 1 LIMIT 3`
      );
      for (const c of compRows) {
        emailService.notifyNewCaseToCompliance(c.email).catch(() => {});
      }
    } catch (_) {}

    // In-app notification for compliance officers
    createNotification({
      targetRole: 'Compliance_Officer',
      type: 'new_case',
      title: 'New Case Submitted',
      message: `A new ${category?.replace(/_/g, ' ')} case (${referenceId}) has been submitted and requires review.`,
      caseId,
    });

    return res.status(201).json({
      message: 'Report submitted successfully',
      case_id: caseId,
      reference_id: referenceId,
      verification_token: verificationToken,
      status: 'New',
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[CASE] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to submit report' });
  }
};

// ── List Cases ────────────────────────────────────────────────

/**
 * GET /api/cases
 * Returns paginated case list. Filters based on user role.
 */
const listCases = async (req, res) => {
  const user = req.user;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { status, severity_level, category, search, branch_or_dept, from_date, to_date, case_id } = req.query;

  try {
    let whereConditions = ['c.deleted_at IS NULL'];
    let params = [];

    // Role-based filtering — per spec: Investigators see ONLY cases assigned to them
    if (user.role === 'Investigator') {
      whereConditions.push('c.assigned_investigator = ?');
      params.push(user.userId);
    } else if (user.role === 'Employee' || user.role === 'Branch_Manager') {
      whereConditions.push('c.user_id = ?');
      params.push(user.userId);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status);
    }
    if (severity_level) {
      whereConditions.push('c.severity_level = ?');
      params.push(severity_level);
    }
    if (category) {
      whereConditions.push('c.category = ?');
      params.push(category);
    }
    if (branch_or_dept) {
      whereConditions.push('c.branch_or_dept LIKE ?');
      params.push(`%${branch_or_dept}%`);
    }
    if (case_id) {
      whereConditions.push('c.case_id = ?');
      params.push(parseInt(case_id));
    }
    if (from_date) {
      whereConditions.push('c.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      whereConditions.push('c.created_at <= ?');
      params.push(`${to_date} 23:59:59`);
    }
    if (search) {
      whereConditions.push('(c.reference_id LIKE ? OR c.category LIKE ? OR c.branch_or_dept LIKE ?)');
      params.push(`${search.toUpperCase()}%`, `%${search}%`, `%${search}%`);
    }

    const where = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM cases c ${where}`,
      params
    );
    const total = countRows[0].total;

    const [cases] = await pool.execute(
      `SELECT c.case_id, c.reference_id, c.category, c.status, c.severity_level,
              c.reporter_type, c.branch_or_dept, c.created_at, c.updated_at,
              u.username AS assigned_investigator
       FROM cases c
       LEFT JOIN users u ON c.assigned_investigator = u.user_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Map case_id to id for frontend compatibility
    const mappedCases = cases.map(c => ({
      id: c.case_id,
      reference_id: c.reference_id,
      category: c.category,
      status: c.status,
      priority: c.severity_level, // severity_level maps to priority on client
      submitted_by_type: c.reporter_type?.toLowerCase(),
      incident_date: c.created_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
      assigned_investigator: c.assigned_investigator,
    }));

    return res.status(200).json({
      cases: mappedCases,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[CASE] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

// ── Get Single Case ───────────────────────────────────────────

/**
 * GET /api/cases/:id
 * Returns full case detail. Staff only.
 */
const getCaseById = async (req, res) => {
  const user = req.user;
  const caseId = parseInt(req.params.id);

  try {
    const [rows] = await pool.execute(
      `SELECT c.*, u.username AS assigned_investigator_name, u.email AS investigator_email
       FROM cases c
       LEFT JOIN users u ON c.assigned_investigator = u.user_id
       WHERE c.case_id = ? AND c.deleted_at IS NULL`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = rows[0];

    // Role access check
    if (user.role === 'System_Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrators are blocked from viewing case details due to ethical wall policies.' });
    }
    if (user.role === 'Employee' || user.role === 'Branch_Manager') {
      if (caseData.user_id !== user.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    if (user.role === 'Investigator') {
      // Investigators can ONLY open cases assigned directly to them
      if (caseData.assigned_investigator !== user.userId) {
        return res.status(403).json({ error: 'Access denied. This case is not assigned to you.' });
      }
    }

    // Map to client format
    const formattedCase = {
      id: caseData.case_id,
      reference_id: caseData.reference_id,
      category: caseData.category,
      status: caseData.status,
      priority: caseData.severity_level, // priority maps to severity_level
      submitted_by_type: caseData.reporter_type?.toLowerCase(),
      incident_date: caseData.created_at,
      incident_location: caseData.branch_or_dept,
      created_at: caseData.created_at,
      updated_at: caseData.updated_at,
      assigned_to: caseData.assigned_investigator,
      assigned_investigator: caseData.assigned_investigator_name,
      investigator_email: caseData.investigator_email,
      description: caseData.description,
      owner_id: caseData.user_id,
      user_id: caseData.user_id,
      is_escalated: caseData.is_escalated === 1 || caseData.is_escalated === true,
    };

    // Allow request owners, assigned Investigators, and Compliance Officers to view full description.
    const isAssignedInvestigator = user.role === 'Investigator' && caseData.assigned_investigator === user.userId;
    const canViewDescription = user.role === 'Compliance_Officer' || isAssignedInvestigator || caseData.user_id === user.userId;
    if (!canViewDescription) {
      delete formattedCase.description;
    }

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'CASE_VIEWED',
      metadata: { case_id: caseId },
    });

    return res.status(200).json({ case: formattedCase });
  } catch (err) {
    console.error('[CASE] Get error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch case' });
  }
};

// ── Edit own request (staff) ───────────────────────────────

/**
 * PATCH /api/cases/:id
 * Lets an authenticated staff user update their own request description.
 */
const editCase = async (req, res) => {
  const user = req.user;
  const caseId = parseInt(req.params.id);
  const body = req.body || {};
  const {
    description,
    branch_or_dept,
    branch,
    department,
    severity_level,
    status,
    priority,
    assigned_to,
    assigned_investigator,
    newStatus,
    newPriority,
  } = body;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, user_id, status, severity_level, assigned_investigator, is_escalated, reference_id, category FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = rows[0];
    const isCompliance = user.role === 'Compliance_Officer';
    const isInvestigator = user.role === 'Investigator';
    const isOwner = caseData.user_id === user.userId;

    if (!isCompliance && !isInvestigator && !isOwner) {
      return res.status(403).json({ error: 'You can only edit your own requests.' });
    }

    if (isInvestigator && caseData.assigned_investigator !== user.userId) {
      return res.status(403).json({ error: 'You can only update cases assigned to you.' });
    }

    const updates = [];
    const params = [];
    let newEscalatedStatus = caseData.is_escalated;

    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    const effectiveBranch = branch_or_dept ?? branch ?? department;
    if (effectiveBranch !== undefined) {
      updates.push('branch_or_dept = ?');
      params.push(effectiveBranch);
    }
    const effectiveSeverity = severity_level ?? priority ?? newPriority;
    // Only Compliance Officers may change severity/priority per BRD
    if (effectiveSeverity !== undefined) {
      if (!isCompliance) {
        return res.status(403).json({ error: 'Only Compliance Officers may change case severity/priority.' });
      }
      updates.push('severity_level = ?');
      params.push(effectiveSeverity);

      // Escalate to Critical if severity is set to Critical
      if (effectiveSeverity === 'Critical' && !caseData.is_escalated) {
        newEscalatedStatus = 1;
      }
    }
    const effectiveStatus = status ?? newStatus;
    if (effectiveStatus !== undefined) {
      if (!isInvestigator && !isCompliance) {
        return res.status(403).json({ error: 'Only investigators and compliance officers can update case status.' });
      }
      if (effectiveStatus !== caseData.status) {
        if (isInvestigator && !INVESTIGATOR_STATUSES.includes(effectiveStatus)) {
          return res.status(403).json({ error: 'Investigators may only update status within their allowed workflow.' });
        }
        if (isCompliance && !COMPLIANCE_OFFICER_STATUSES.includes(effectiveStatus)) {
          return res.status(403).json({ error: 'Compliance Officers may only update status during assignment and review stages.' });
        }
      }
      updates.push('status = ?');
      params.push(effectiveStatus);
    }
    const effectiveAssignment = assigned_to ?? assigned_investigator;
    if (effectiveAssignment !== undefined) {
      // Only Compliance Officers may assign/reassign cases per BRD
      if (!isCompliance) {
        return res.status(403).json({ error: 'Only Compliance Officers may assign or reassign cases.' });
      }
      updates.push('assigned_investigator = ?');
      params.push(effectiveAssignment);
    }

    // Add is_escalated update if severity was changed to Critical
    if (newEscalatedStatus !== caseData.is_escalated) {
      updates.push('is_escalated = ?');
      params.push(newEscalatedStatus);
    }

    if (updates.length === 0) {
      return res.status(200).json({ message: 'No changes detected' });
    }

    params.push(caseId);
    await pool.execute(`UPDATE cases SET ${updates.join(', ')}, updated_at = NOW() WHERE case_id = ?`, params);

    // If escalated to Critical, notify CEO
    if (newEscalatedStatus === 1 && caseData.is_escalated === 0) {
      try {
        const [ceoRows] = await pool.execute(
          `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
        );
        if (ceoRows.length > 0) {
          emailService.notifyCEOEscalation(ceoRows[0].email, {
            reference_id: caseData.reference_id,
            category: caseData.category,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'CASE_EDITED_BY_STAFF',
      performedBy: user.username,
      performedByType: 'staff',
      metadata: { updated_fields: updates.map(u => u.split('=')[0].trim()) },
    });

    return res.status(200).json({ message: 'Case updated successfully' });
  } catch (err) {
    console.error('[CASE] Staff edit error:', err.message);
    return res.status(500).json({ error: 'Failed to update request' });
  }
};

/**
 * DELETE /api/cases/:id
 * Soft deletes a staff-owned request with a required justification.
 */
const deleteCase = async (req, res) => {
  const user = req.user;
  const caseId = parseInt(req.params.id);
  const { justification, requires_approval } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, user_id, deleted_at FROM cases WHERE case_id = ?`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = rows[0];
    if (caseData.deleted_at) {
      return res.status(410).json({ error: 'This request has already been deleted.' });
    }

    if (caseData.user_id !== user.userId && !['Compliance_Officer', 'System_Admin'].includes(user.role)) {
      return res.status(403).json({ error: 'You can only delete your own requests.' });
    }

    if (!justification || String(justification).trim().length < 10) {
      return res.status(400).json({ error: 'A justification of at least 10 characters is required.' });
    }

    await pool.execute(
      `UPDATE cases SET deleted_at = NOW(), updated_at = NOW() WHERE case_id = ?`,
      [caseId]
    );

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'CASE_DELETED_BY_STAFF',
      performedBy: user.username,
      performedByType: 'staff',
      metadata: { justification: String(justification).trim(), requires_approval: Boolean(requires_approval) },
    });

    return res.status(200).json({ message: 'Case deleted successfully' });
  } catch (err) {
    console.error('[CASE] Staff delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete request' });
  }
};

// ── Track Case by Reference ID (Anonymous) ────────────────────

/**
 * GET /api/cases/track?reference_id=XXXXXXXXXXXX
 * Allows anonymous reporters to check status using their reference code.
 */
const trackCase = async (req, res) => {
  const { reference_id } = req.query;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, reference_id, category, status, severity_level, created_at, updated_at
       FROM cases WHERE reference_id = ? AND deleted_at IS NULL`,
      [reference_id.toUpperCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No case found with that reference ID' });
    }

    const caseData = rows[0];

    // Fetch non-internal notes for the reporter
    const [notes] = await pool.execute(
      `SELECT note_text AS body, sender_type AS author_type, created_at
       FROM investigationnotes
       WHERE case_id = ? AND is_internal_only = 0
       ORDER BY created_at ASC`,
      [caseData.case_id]
    );

    // Map to client format
    const formattedNotes = notes.map(n => ({
      body: n.body,
      author_type: n.author_type === 'Investigator' ? 'staff' : 'anonymous',
      created_at: n.created_at,
    }));

    return res.status(200).json({
      case: {
        reference_id: caseData.reference_id,
        category: caseData.category,
        status: caseData.status,
        priority: caseData.severity_level,
        created_at: caseData.created_at,
        updated_at: caseData.updated_at,
      },
      correspondence: formattedNotes,
    });
  } catch (err) {
    console.error('[CASE] Track error:', err.message);
    return res.status(500).json({ error: 'Failed to track case' });
  }
};

// ── Update Case Status / Assignment ──────────────────────────

/**
 * PATCH /api/cases/:id/status
 * Updates case status, priority, or assignment.
 * Rule: Investigators can ONLY update cases assigned to them.
 */
const updateCaseStatus = async (req, res) => {
  const user   = req.user;
  const caseId = parseInt(req.params.id);
  const { status, priority, assigned_to } = req.body;

  try {
    const [existing] = await pool.execute(
      `SELECT case_id, status, severity_level, assigned_investigator, is_escalated, reference_id, category FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const prev = existing[0];

    // Only Investigators and Compliance Officers can update status/priority/assignee
    if (user.role !== 'Compliance_Officer' && user.role !== 'Investigator') {
      return res.status(403).json({
        error: 'Access denied. Only Investigators and Compliance Officers can update case status or assignments.',
      });
    }

    // ── Investigator restriction: can only update their own assigned cases ──
    if (user.role === 'Investigator') {
      if (prev.assigned_investigator !== user.userId) {
        return res.status(403).json({
          error: 'You can only update cases that are assigned to you.',
        });
      }
    }

    // ── Reassignment restriction: Only Compliance Officer can assign or reassign ──
    if (assigned_to !== undefined && user.role !== 'Compliance_Officer') {
      return res.status(403).json({
        error: 'Only a Compliance Officer / Team Lead can assign or reassign cases.',
      });
    }

    const updates = [];
    const params  = [];
    let newEscalatedStatus = prev.is_escalated;

    if (status) {
      if (status !== prev.status) {
        if (user.role === 'Investigator' && !INVESTIGATOR_STATUSES.includes(status)) {
          return res.status(403).json({ error: 'Investigators may only update status within their allowed workflow.' });
        }
        if (user.role === 'Compliance_Officer' && !COMPLIANCE_OFFICER_STATUSES.includes(status)) {
          return res.status(403).json({ error: 'Compliance Officers may only update status during assignment and review stages.' });
        }
      }
      updates.push('status = ?');
      params.push(status);
    }
    if (priority) {
      // Only Compliance Officers may change priority per BRD
      if (user.role !== 'Compliance_Officer') {
        return res.status(403).json({ error: 'Only Compliance Officers may change case priority.' });
      }
      updates.push('severity_level = ?');
      params.push(priority);

      // Escalate if severity is set to Critical
      if (priority === 'Critical' && !prev.is_escalated) {
        newEscalatedStatus = 1;
      }
    }
    if (assigned_to !== undefined &&
        user.role !== 'Investigator')   { updates.push('assigned_investigator = ?'); params.push(assigned_to); }

    // Update is_escalated flag if severity changed to Critical
    if (newEscalatedStatus !== prev.is_escalated) {
      updates.push('is_escalated = ?');
      params.push(newEscalatedStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(caseId);
    await pool.execute(`UPDATE cases SET ${updates.join(', ')}, updated_at = NOW() WHERE case_id = ?`, params);

    // If escalated to Critical, notify CEO
    if (newEscalatedStatus === 1 && prev.is_escalated === 0) {
      try {
        const [ceoRows] = await pool.execute(
          `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
        );
        if (ceoRows.length > 0) {
          emailService.notifyCEOEscalation(ceoRows[0].email, {
            reference_id: prev.reference_id,
            category: prev.category,
          }).catch(() => {});
        }
      } catch (_) {}
    }

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'CASE_UPDATED',
      metadata: {
        prev_status:    prev.status,
        new_status:     status   || prev.status,
        prev_priority:  prev.severity_level,
        new_priority:   priority || prev.severity_level,
        assigned_investigator: assigned_to,
        escalated: newEscalatedStatus === 1,
      },
    });

    // Notify newly assigned investigator
    if (assigned_to !== undefined && assigned_to !== prev.assigned_investigator) {
      try {
        const [invRows] = await pool.execute(
          `SELECT email FROM users WHERE user_id = ? AND is_active = 1`,
          [assigned_to]
        );
        if (invRows.length > 0) {
          emailService.notifyAssignment(invRows[0].email).catch(() => {});
        }
      } catch (_) {}

      // In-app notification for assigned investigator
      createNotification({
        userId: assigned_to,
        type: 'case_assigned',
        title: 'Case Assigned to You',
        message: `Case ${prev.reference_id} (${prev.category?.replace(/_/g, ' ')}) has been assigned to you for investigation.`,
        caseId,
      });
    }

    // Notify status change to compliance officers
    if (status && status !== prev.status) {
      createNotification({
        targetRole: 'Compliance_Officer',
        type: 'status_change',
        title: 'Case Status Updated',
        message: `Case ${prev.reference_id} status changed from ${prev.status?.replace(/_/g, ' ')} to ${status?.replace(/_/g, ' ')}.`,
        caseId,
      });
    }

    return res.status(200).json({ message: 'Case updated successfully' });
  } catch (err) {
    console.error('[CASE] Update error:', err.message);
    return res.status(500).json({ error: 'Failed to update case' });
  }
};

// ── Executive Dashboard Stats ─────────────────────────────────

/**
 * GET /api/cases/stats
 * Returns aggregate statistics for CEO/executive dashboard.
 */
const getCaseStats = async (req, res) => {
  try {
    const [[statusCounts]] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'New') AS new_cases,
         SUM(status = 'Under_Review') AS under_review,
         SUM(status = 'Investigating') AS in_progress,
         SUM(status = 'Resolved') AS resolved,
         SUM(status = 'Closed') AS closed,
         SUM(severity_level = 'Critical') AS critical,
         SUM(severity_level = 'High') AS high
       FROM cases
       WHERE deleted_at IS NULL`
    );

    const [categoryCounts] = await pool.execute(
      `SELECT category, COUNT(*) AS total FROM cases WHERE deleted_at IS NULL GROUP BY category ORDER BY total DESC`
    );

    const [monthlyTrend] = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
       FROM cases
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND deleted_at IS NULL
       GROUP BY month ORDER BY month ASC`
    );

    const [resolutionTime] = await pool.execute(
      `SELECT
         ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)), 1) AS avg_resolution_hours
       FROM cases
       WHERE status IN ('Resolved', 'Closed') AND deleted_at IS NULL`
    );

    const [escalatedCases] = await pool.execute(
      `SELECT c.case_id, c.reference_id, c.category, c.status, c.severity_level,
              c.created_at, u.username AS assigned_investigator
       FROM cases c
       LEFT JOIN users u ON c.assigned_investigator = u.user_id
       WHERE c.is_escalated = 1 AND c.deleted_at IS NULL
       ORDER BY c.created_at DESC`
    );

    const mappedEscalated = escalatedCases.map(c => ({
      id: c.case_id,
      reference_id: c.reference_id,
      category: c.category,
      status: c.status,
      priority: c.severity_level,
      submitted_by_type: c.reporter_type?.toLowerCase(),
      created_at: c.created_at,
      assigned_investigator: c.assigned_investigator,
    }));

    return res.status(200).json({
      overview: {
        total: statusCounts.total || 0,
        new_cases: statusCounts.new_cases || 0,
        under_review: statusCounts.under_review || 0,
        in_progress: statusCounts.in_progress || 0,
        resolved: statusCounts.resolved || 0,
        closed: statusCounts.closed || 0,
        critical: statusCounts.critical || 0,
        high: statusCounts.high || 0,
      },
      by_category: categoryCounts,
      monthly_trend: monthlyTrend,
      avg_resolution_hours: resolutionTime[0]?.avg_resolution_hours || null,
      escalated_cases: mappedEscalated,
    });
  } catch (err) {
    console.error('[CASE] Stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// ── Escalate Case to CEO ──────────────────────────────────────

/**
 * POST /api/cases/:id/escalate
 * Compliance Officers can manually escalate a case to the CEO.
 */
const escalateCase = async (req, res) => {
  const user = req.user;
  const caseId = parseInt(req.params.id);

  try {
    const [existing] = await pool.execute(
      `SELECT case_id, is_escalated, reference_id, category FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = existing[0];
    if (caseData.is_escalated) {
      return res.status(400).json({ error: 'Case is already escalated' });
    }

    // Only Compliance Officers may manually escalate per BRD
    if (user.role !== 'Compliance_Officer') {
      return res.status(403).json({ error: 'Only a Compliance Officer may escalate a case to the CEO.' });
    }

    await pool.execute(
      `UPDATE cases SET is_escalated = 1, updated_at = NOW() WHERE case_id = ?`,
      [caseId]
    );

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'CASE_ESCALATED',
      metadata: { reference_id: caseData.reference_id },
    });

    try {
      const [ceoRows] = await pool.execute(
        `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
      );
      if (ceoRows.length > 0) {
        emailService.notifyCEOEscalation(ceoRows[0].email, {
          reference_id: caseData.reference_id,
          category: caseData.category,
        }).catch(() => {});
      }
    } catch (_) {}

    // In-app notification for CEO
    createNotification({
      targetRole: 'CEO',
      type: 'case_escalated',
      title: 'Case Escalated',
      message: `Case ${caseData.reference_id} (${caseData.category?.replace(/_/g, ' ')}) has been escalated and requires your attention.`,
      caseId,
    });

    return res.status(200).json({ message: 'Case escalated successfully' });
  } catch (err) {
    console.error('[CASE] Escalation error:', err.message);
    return res.status(500).json({ error: 'Failed to escalate case' });
  }
};

/**
 * PATCH /api/cases/anonymous
 * Allows anonymous reporters to update category, description, or location of their report.
 * Requires reference_id and correct verification_token.
 */
const editCaseAnonymous = async (req, res) => {
  const { reference_id, verification_token, category, description } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, verification_token FROM cases WHERE reference_id = ? AND deleted_at IS NULL`,
      [reference_id.toUpperCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No case found with that reference ID' });
    }

    const caseData = rows[0];

    if (caseData.verification_token !== verification_token) {
      return res.status(401).json({ error: 'Invalid verification token' });
    }

    const updates = [];
    const params = [];

    if (category) {
      updates.push('category = ?');
      params.push(category);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(caseData.case_id);
    await pool.execute(`UPDATE cases SET ${updates.join(', ')} WHERE case_id = ?`, params);

    await writeAuditLog({
      userId: null,
      caseId: caseData.case_id,
      action: 'CASE_EDITED_BY_ANON',
      performedBy: null,
      performedByType: 'anonymous',
      metadata: {
        reference_id,
        updated_fields: Object.keys(req.body).filter(k => ['category', 'description'].includes(k))
      },
    });

    return res.status(200).json({ message: 'Report updated successfully' });
  } catch (err) {
    console.error('[CASE] Anonymous edit error:', err.message);
    return res.status(500).json({ error: 'Failed to update report' });
  }
};

/**
 * DELETE /api/cases/anonymous
 * Allows anonymous reporters to request a soft delete of their report.
 * Requires reference_id and correct verification_token.
 */
const deleteCaseAnonymous = async (req, res) => {
  const { reference_id, verification_token } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, verification_token FROM cases WHERE reference_id = ? AND deleted_at IS NULL`,
      [reference_id.toUpperCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No case found with that reference ID' });
    }

    const caseData = rows[0];

    if (caseData.verification_token !== verification_token) {
      return res.status(401).json({ error: 'Invalid verification token' });
    }

    await pool.execute(
      `UPDATE cases SET deleted_at = NOW(), updated_at = NOW() WHERE case_id = ?`,
      [caseData.case_id]
    );

    await writeAuditLog({
      userId: null,
      caseId: caseData.case_id,
      action: 'CASE_DELETED_BY_ANON',
      performedBy: null,
      performedByType: 'anonymous',
      metadata: { reference_id },
    });

    return res.status(200).json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error('[CASE] Anonymous delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
};

/**
 * POST /api/cases/:id/request-manager-help
 * Allows an Investigator or Compliance Officer to request help from the Branch Manager.
 */
const requestManagerHelp = async (req, res) => {
  const caseId = parseInt(req.params.id);
  const user = req.user;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, reference_id FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    await pool.execute(
      `UPDATE cases SET manager_help_requested = 1, updated_at = NOW() WHERE case_id = ?`,
      [caseId]
    );

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'MANAGER_HELP_REQUESTED',
      performedBy: user.username,
      performedByType: 'staff',
      metadata: { reference_id: rows[0].reference_id },
    });

    return res.status(200).json({ message: 'Help requested from Branch Manager successfully' });
  } catch (err) {
    console.error('[CASE] Request manager help error:', err.message);
    return res.status(500).json({ error: 'Failed to request manager help' });
  }
};

module.exports = {
  createCase,
  listCases,
  getCaseById,
  editCase,
  deleteCase,
  trackCase,
  updateCaseStatus,
  getCaseStats,
  escalateCase,
  editCaseAnonymous,
  deleteCaseAnonymous,
  requestManagerHelp
};
