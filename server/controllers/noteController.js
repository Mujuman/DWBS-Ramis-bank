const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const { createNotification } = require('./notificationController');
const { TERMINAL_STATUSES } = require('../constants/caseWorkflow');

const normalizeRecipientRole = (recipientRole) =>
  recipientRole === 'Compliance_Officer' ? 'Compliance_Officer' : 'Investigator';

const addReporterNote = async (caseId, noteBody, recipientRole = 'Investigator') => {
  const audienceType = normalizeRecipientRole(recipientRole);
  await pool.execute(
    `INSERT INTO investigationnotes (case_id, sender_type, audience_type, note_text, is_internal_only)
     VALUES (?, 'Reporter', ?, ?, 0)`,
    [caseId, audienceType, noteBody]
  );
  return audienceType;
};

/**
 * POST /api/cases/anonymous/notes
 * Allows anonymous reporters to reply to investigator/compliance messages
 * using their reference ID and verification token.
 */
const createAnonNote = async (req, res) => {
  const { reference_id, verification_token, body, recipient_role } = req.body;
  const recipientRole = normalizeRecipientRole(recipient_role);

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
       WHERE case_id = ? AND sender_type = ? AND is_internal_only = 0
       LIMIT 1`,
      [caseData.case_id, recipientRole]
    );

    if (staffNotes.length === 0) {
      return res.status(400).json({ error: 'You can only reply after the investigation team has sent a message.' });
    }

    const audienceType = await addReporterNote(caseData.case_id, body, recipientRole);

    if (!TERMINAL_STATUSES.includes(caseData.status)) {
      await pool.execute(
        `UPDATE cases SET status = 'Pending_Evidence', updated_at = NOW() WHERE case_id = ?`,
        [caseData.case_id]
      );
    }

    await writeAuditLog({
      caseId: caseData.case_id,
      action: 'ANON_REPORTER_REPLIED',
      performedBy: null,
      performedByType: 'anonymous',
      metadata: { reference_id, recipient_role: audienceType },
    });

    // Notify assigned investigator and compliance officers about the anonymous reply
    try {
      const [caseInfo] = await pool.execute(
        `SELECT assigned_investigator, reference_id FROM cases WHERE case_id = ?`,
        [caseData.case_id]
      );
      if (caseInfo.length > 0) {
        if (audienceType === 'Investigator' && caseInfo[0].assigned_investigator) {
          createNotification({
            userId: caseInfo[0].assigned_investigator,
            type: 'new_message',
            title: 'New Reporter Message',
            message: `The anonymous reporter on case ${caseInfo[0].reference_id} has sent a new response.`,
            caseId: caseData.case_id,
          });
        }
        if (audienceType === 'Compliance_Officer') {
          createNotification({
            targetRole: 'Compliance_Officer',
            type: 'new_message',
            title: 'New Anonymous Reporter Message',
            message: `An anonymous reporter responded to the Compliance Team Lead on case ${caseInfo[0].reference_id}.`,
            caseId: caseData.case_id,
          });
        }
      }
    } catch (_) {}

    return res.status(201).json({
      message: `Your response has been sent to the ${audienceType === 'Compliance_Officer' ? 'Compliance Team Lead' : 'Case Investigator'}.`,
    });
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
  const { body, is_internal_only, recipient_role } = req.body;

  try {
    const [cases] = await pool.execute(`SELECT case_id FROM cases WHERE case_id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Anonymous reporters cannot post internal notes
    const isInternal = identity.type === 'staff' ? (is_internal_only === true || is_internal_only === 'true') : false;

    // Determine sender_type: staff owners are modeled as 'Reporter' so their clarifications appear as correspondence.
    const isStaffReporter = identity.type === 'staff' && ['Employee', 'Branch_Manager'].includes(req.user?.role);
    const senderType = identity.type === 'staff' && !isStaffReporter
      ? (req.user?.role === 'Compliance_Officer' ? 'Compliance_Officer' : 'Investigator')
      : 'Reporter';
    const audienceType = senderType === 'Reporter' ? normalizeRecipientRole(recipient_role) : senderType;

    await pool.execute(
      `INSERT INTO investigationnotes (case_id, sender_type, audience_type, note_text, is_internal_only)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, senderType, audienceType, body, isInternal ? 1 : 0]
    );

    // Update case status when reporter replies during active investigation
    if (identity.type === 'anonymous') {
      const placeholders = TERMINAL_STATUSES.map(() => '?').join(', ');
      await pool.execute(
        `UPDATE cases SET status = 'Pending_Evidence', updated_at = NOW()
         WHERE case_id = ? AND status NOT IN (${placeholders})`,
        [caseId, ...TERMINAL_STATUSES]
      );
    }

    await writeAuditLog({
      caseId,
      action: 'NOTE_ADDED',
      performedBy: identity.label,
      performedByType: identity.type,
      metadata: { is_internal_only: isInternal, recipient_role: audienceType },
    });

    // Create notification for relevant parties about the new message
    try {
      const [caseInfo] = await pool.execute(
        `SELECT assigned_investigator, reference_id, user_id FROM cases WHERE case_id = ?`,
        [caseId]
      );
      if (caseInfo.length > 0) {
        const ref = caseInfo[0].reference_id;
        if (identity.type === 'staff' && ['Investigator', 'Compliance_Officer'].includes(senderType)) {
          // Investigator posted → notify Compliance Officer
          // Also notify the case owner (if authenticated staff reporter) about the investigator's message
          if (caseInfo[0].user_id) {
            createNotification({
              userId: caseInfo[0].user_id,
              type: 'new_message',
              title: 'New Message on Your Case',
              message: `The ${senderType === 'Compliance_Officer' ? 'Compliance Team Lead' : 'Case Investigator'} has posted a new message on your case ${ref}.`,
              caseId,
            });
          }
        } else if (identity.type === 'staff' && senderType === 'Reporter') {
          // Staff reporter (Employee/Branch_Manager) replied → notify assigned investigator
          if (audienceType === 'Investigator' && caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Reporter Message',
              message: `The reporter on case ${ref} has sent a new message.`,
              caseId,
            });
          }
          // Also notify compliance officers about staff reporter reply
          if (audienceType === 'Compliance_Officer') {
            createNotification({
              targetRole: 'Compliance_Officer',
              type: 'new_message',
              title: 'New Staff Reporter Message',
              message: `A staff reporter responded to the Compliance Team Lead on case ${ref}.`,
              caseId,
            });
          }
        } else if (identity.type === 'anonymous') {
          // Anonymous reporter posted via authenticated note route → notify investigator & compliance
          if (audienceType === 'Investigator' && caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Reporter Message',
              message: `The anonymous reporter on case ${ref} has sent a new response.`,
              caseId,
            });
          }
          if (audienceType === 'Compliance_Officer') {
            createNotification({
              targetRole: 'Compliance_Officer',
              type: 'new_message',
              title: 'New Anonymous Reporter Message',
              message: `An anonymous reporter responded to the Compliance Team Lead on case ${ref}.`,
              caseId,
            });
          }
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
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND is_internal_only = 0
               ORDER BY created_at ASC`;
      params = [caseId];
    } else if (req.user?.role === 'Investigator') {
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND audience_type IN ('General', 'Investigator')
               ORDER BY created_at ASC`;
      params = [caseId];
    } else if (req.user?.role === 'Compliance_Officer') {
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND audience_type IN ('General', 'Compliance_Officer')
               ORDER BY created_at ASC`;
      params = [caseId];
    } else {
      // High-privilege staff: see all notes including internal
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ?
               ORDER BY created_at ASC`;
      params = [caseId];
    }

    let notes;
    try {
      [notes] = await pool.execute(query, params);
    } catch (notesErr) {
      if (!/audience_type/i.test(notesErr.message || '')) throw notesErr;
      const legacyWhere = identity.type === 'anonymous' || !highPriv
        ? 'WHERE case_id = ? AND is_internal_only = 0'
        : 'WHERE case_id = ?';
      [notes] = await pool.execute(
        `SELECT note_id as id, sender_type as author_type, note_text as body,
                is_internal_only, created_at
         FROM investigationnotes
         ${legacyWhere}
         ORDER BY created_at ASC`,
        [caseId]
      );
      notes = notes.map(note => ({ ...note, audience_type: 'General' }));
    }
    return res.status(200).json({ notes });
  } catch (err) {
    console.error('[NOTE] Get error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

module.exports = { createAnonNote, createNote, getNotes };
