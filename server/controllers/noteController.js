const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const { createNotification } = require('./notificationController');

const addReporterNote = async (caseId, noteBody) => {
  await pool.execute(
    `INSERT INTO investigationnotes (case_id, sender_type, note_text, is_internal_only)
     VALUES (?, 'Reporter', ?, 0)`,
    [caseId, noteBody]
  );
};

/**
 * POST /api/cases/anonymous/notes
 * Allows anonymous reporters to reply to investigator/compliance messages
 * using their reference ID and verification token.
 */
const createAnonNote = async (req, res) => {
  const { reference_id, verification_token, body } = req.body;

  try {
    const [rows] = await pool.execute(
      `SELECT case_id, verification_token, status FROM cases WHERE reference_id = ? AND deleted_at IS NULL`,
      [reference_id.toUpperCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No case found with that reference ID' });
    }

    const caseData = rows[0];

    if (caseData.verification_token !== verification_token) {
      return res.status(401).json({ error: 'Invalid verification token' });
    }

    const [staffNotes] = await pool.execute(
      `SELECT note_id FROM investigationnotes
       WHERE case_id = ? AND sender_type = 'Investigator' AND is_internal_only = 0
       LIMIT 1`,
      [caseData.case_id]
    );

    if (staffNotes.length === 0) {
      return res.status(400).json({ error: 'You can only reply after the investigation team has sent a message.' });
    }

    await addReporterNote(caseData.case_id, body);

    if (!['Resolved', 'Closed'].includes(caseData.status)) {
      await pool.execute(
        `UPDATE cases SET status = 'Awaiting_Response', updated_at = NOW() WHERE case_id = ?`,
        [caseData.case_id]
      );
    }

    await writeAuditLog({
      caseId: caseData.case_id,
      action: 'ANON_REPORTER_REPLIED',
      performedBy: null,
      performedByType: 'anonymous',
      metadata: { reference_id },
    });

    // Notify assigned investigator and compliance officers about the anonymous reply
    try {
      const [caseInfo] = await pool.execute(
        `SELECT assigned_investigator, reference_id FROM cases WHERE case_id = ?`,
        [caseData.case_id]
      );
      if (caseInfo.length > 0) {
        // Notify assigned investigator
        if (caseInfo[0].assigned_investigator) {
          createNotification({
            userId: caseInfo[0].assigned_investigator,
            type: 'new_message',
            title: 'New Reporter Message',
            message: `The anonymous reporter on case ${caseInfo[0].reference_id} has sent a new response.`,
            caseId: caseData.case_id,
          });
        }
        // Notify compliance officers about anonymous reporter reply
        createNotification({
          targetRole: 'Compliance_Officer',
          type: 'new_message',
          title: 'New Anonymous Reporter Message',
          message: `An anonymous reporter responded on case ${caseInfo[0].reference_id}.`,
          caseId: caseData.case_id,
        });
      }
    } catch (_) {}

    return res.status(201).json({ message: 'Your response has been sent to the investigation team.' });
  } catch (err) {
    console.error('[NOTE] Anonymous create error:', err.message);
    return res.status(500).json({ error: 'Failed to add response' });
  }
};

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

    // Determine sender_type: staff owners are modeled as 'Reporter' so their clarifications appear as correspondence.
    const isStaffReporter = identity.type === 'staff' && ['Employee', 'Branch_Manager'].includes(req.user?.role);
    const senderType = identity.type === 'staff' && !isStaffReporter ? 'Investigator' : 'Reporter';

    await pool.execute(
      `INSERT INTO investigationnotes (case_id, sender_type, note_text, is_internal_only)
       VALUES (?, ?, ?, ?)`,
      [caseId, senderType, body, isInternal ? 1 : 0]
    );

    // Update case status to Awaiting_Response if reporter replied
    if (identity.type === 'anonymous') {
      await pool.execute(
        `UPDATE cases SET status = 'Awaiting_Response', updated_at = NOW()
         WHERE case_id = ? AND status NOT IN ('Resolved', 'Closed')`,
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

    // Create notification for relevant parties about the new message
    try {
      const [caseInfo] = await pool.execute(
        `SELECT assigned_investigator, reference_id, user_id FROM cases WHERE case_id = ?`,
        [caseId]
      );
      if (caseInfo.length > 0) {
        const ref = caseInfo[0].reference_id;
        if (identity.type === 'staff' && senderType === 'Investigator') {
          // Investigator posted → notify Compliance Officer
          createNotification({
            targetRole: 'Compliance_Officer',
            type: 'new_message',
            title: 'New Investigation Note',
            message: `A new note was added to case ${ref}.`,
            caseId,
          });
          // Also notify the case owner (if authenticated staff reporter) about the investigator's message
          if (caseInfo[0].user_id) {
            createNotification({
              userId: caseInfo[0].user_id,
              type: 'new_message',
              title: 'New Message on Your Case',
              message: `The investigation team has posted a new message on your case ${ref}.`,
              caseId,
            });
          }
        } else if (identity.type === 'staff' && senderType === 'Reporter') {
          // Staff reporter (Employee/Branch_Manager) replied → notify assigned investigator
          if (caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Reporter Message',
              message: `The reporter on case ${ref} has sent a new message.`,
              caseId,
            });
          }
          // Also notify compliance officers about staff reporter reply
          createNotification({
            targetRole: 'Compliance_Officer',
            type: 'new_message',
            title: 'New Staff Reporter Message',
            message: `A staff reporter responded on case ${ref}.`,
            caseId,
          });
        } else if (identity.type === 'anonymous') {
          // Anonymous reporter posted via authenticated note route → notify investigator & compliance
          if (caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Reporter Message',
              message: `The anonymous reporter on case ${ref} has sent a new response.`,
              caseId,
            });
          }
          createNotification({
            targetRole: 'Compliance_Officer',
            type: 'new_message',
            title: 'New Anonymous Reporter Message',
            message: `An anonymous reporter responded on case ${ref}.`,
            caseId,
          });
        }
      }
    } catch (_) {}

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
      ['Investigator', 'Compliance_Officer', 'CEO'].includes(req.user?.role);

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

module.exports = { createAnonNote, createNote, getNotes };
