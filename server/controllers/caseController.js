const { pool } = require('../config/db');
const { generateReferenceId, generateSecureToken } = require('../utils/tokenUtils');
const { writeAuditLog } = require('../services/auditService');
const emailService = require('../services/emailService');

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
    const verificationToken = req.anonSession ? req.anonSession.session_token : generateSecureToken(32);

    const [result] = await pool.execute(
      `INSERT INTO cases
        (reference_id, verification_token, reporter_type, user_id, category,
         branch_or_dept, severity_level, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New')`,
      [
        referenceId,
        verificationToken,
        reporterType,
        userId,
        category,
        branch_or_dept || 'General',
        severity_level || 'Low',
        description,
      ]
    );

    const caseId = result.insertId;

    // Write audit log
    await writeAuditLog({
      userId,
      caseId,
      action: 'CASE_CREATED',
      metadata: { category, severity_level: severity_level || 'Low', status: 'New' },
    });

    // Notify compliance team
    try {
      const [compRows] = await pool.execute(
        `SELECT email FROM users WHERE role = 'Compliance_Officer' AND is_active = 1 LIMIT 3`
      );
      for (const c of compRows) {
        emailService.notifyNewCaseToCompliance(c.email).catch(() => {});
      }
    } catch (_) {}

    return res.status(201).json({
      message: 'Report submitted successfully',
      case_id: caseId,
      reference_id: referenceId,
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
  const { status, severity_level, category, search } = req.query;

  try {
    let whereConditions = [];
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
    if (search) {
      whereConditions.push('c.reference_id LIKE ?');
      params.push(`${search.toUpperCase()}%`);
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
       ORDER BY
         FIELD(c.severity_level, 'Critical', 'High', 'Medium', 'Low'),
         c.created_at DESC
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
       WHERE c.case_id = ?`,
      [caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = rows[0];

    // Role access check
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
    };

    // Restrict description for low-permission roles
    const restrictedRoles = ['Employee', 'Branch_Manager'];
    if (restrictedRoles.includes(user.role)) {
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
       FROM cases WHERE reference_id = ?`,
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
      `SELECT case_id, status, severity_level, assigned_investigator FROM cases WHERE case_id = ?`,
      [caseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const prev = existing[0];

    // ── Investigator restriction: can only update their own assigned cases ──
    if (user.role === 'Investigator') {
      if (prev.assigned_investigator !== user.userId) {
        return res.status(403).json({
          error: 'You can only update cases that are assigned to you.',
        });
      }
      // Investigators cannot reassign cases to others
      if (assigned_to !== undefined) {
        return res.status(403).json({
          error: 'Investigators cannot reassign cases. Contact a Compliance Officer.',
        });
      }
    }

    const updates = [];
    const params  = [];

    if (status)                         { updates.push('status = ?');             params.push(status); }
    if (priority)                       { updates.push('severity_level = ?');     params.push(priority); }
    if (assigned_to !== undefined &&
        user.role !== 'Investigator')   { updates.push('assigned_investigator = ?'); params.push(assigned_to); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(caseId);
    await pool.execute(`UPDATE cases SET ${updates.join(', ')} WHERE case_id = ?`, params);

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
       FROM cases`
    );

    const [categoryCounts] = await pool.execute(
      `SELECT category, COUNT(*) AS total FROM cases GROUP BY category ORDER BY total DESC`
    );

    const [monthlyTrend] = await pool.execute(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total
       FROM cases
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`
    );

    const [resolutionTime] = await pool.execute(
      `SELECT
         ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)), 1) AS avg_resolution_hours
       FROM cases
       WHERE status IN ('Resolved', 'Closed')`
    );

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
    });
  } catch (err) {
    console.error('[CASE] Stats error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

module.exports = { createCase, listCases, getCaseById, trackCase, updateCaseStatus, getCaseStats };
