const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');

/**
 * POST /api/cases/:id/notes
 * Adds a note to the investigation correspondence thread.
 * is_internal_only=true notes are only visible to staff.
 */
const createNote = async (req, res) => {
  const caseId = parseInt(req.params.id);
  const identity = req.identity;
  const { body, is_internal_only } = req.body;

  try {
    const [cases] = await pool.execute(`SELECT case_id FROM cases WHERE case_id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Anonymous reporters cannot post internal notes
    const isInternal = identity.type === 'staff' ? (is_internal_only === true || is_internal_only === 'true') : false;

    // Determine sender_type: 'Investigator' for staff, 'Reporter' for anonymous
    const senderType = identity.type === 'staff' ? 'Investigator' : 'Reporter';

    await pool.execute(
      `INSERT INTO investigationnotes (case_id, sender_type, note_text, is_internal_only)
       VALUES (?, ?, ?, ?)`,
      [caseId, senderType, body, isInternal ? 1 : 0]
    );

    // Update case status to Awaiting_Response if reporter replied
    if (identity.type === 'anonymous') {
      await pool.execute(
        `UPDATE cases SET status = 'Awaiting_Response', updated_at = NOW()
         WHERE case_id = ? AND status = 'Investigation_In_Progress'`,
        [caseId]
      );
    }

    await writeAuditLog({
      caseId,
      action: 'NOTE_ADDED',
      performedBy: identity.label,
      performedByType: identity.type,
      metadata: { is_internal_only: isInternal },
    });

    return res.status(201).json({ message: 'Note added successfully' });
  } catch (err) {
    console.error('[NOTE] Create error:', err.message);
    return res.status(500).json({ error: 'Failed to add note' });
  }
};

/**
 * GET /api/cases/:id/notes
 * Fetches the correspondence thread for a case.
 * - Anonymous reporters see only is_internal_only=0 notes
 * - Staff see all notes (respects is_internal_only filter by default, unless Investigator+)
 */
const getNotes = async (req, res) => {
  const caseId = parseInt(req.params.id);
  const identity = req.identity;

  try {
    const [cases] = await pool.execute(`SELECT case_id FROM cases WHERE case_id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    let query;
    let params;

    // Privilege-aware filter
    const highPriv = identity.type === 'staff' &&
      ['Investigator', 'Compliance_Officer', 'CEO', 'System_Admin'].includes(req.user?.role);

    if (identity.type === 'anonymous' || !highPriv) {
      // Reporter or low-privilege staff: only public notes
      query = `SELECT note_id as id, sender_type as author_type, note_text as body, 
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND is_internal_only = 0
               ORDER BY created_at ASC`;
      params = [caseId];
    } else {
      // High-privilege staff: see all notes including internal
      query = `SELECT note_id as id, sender_type as author_type, note_text as body, 
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ?
               ORDER BY created_at ASC`;
      params = [caseId];
    }

    const [notes] = await pool.execute(query, params);
    return res.status(200).json({ notes });
  } catch (err) {
    console.error('[NOTE] Get error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

module.exports = { createNote, getNotes };
