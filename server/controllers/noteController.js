const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const { createNotification } = require('./notificationController');
const { TERMINAL_STATUSES } = require('../constants/caseWorkflow');

const normalizeRecipientRole = (recipientRole) => {
  if (recipientRole === 'Compliance_Officer') return 'Compliance_Officer';
  if (recipientRole === 'CEO') return 'CEO';
  return 'Investigator';
};

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
 * Allows anonymous reporters to reply to investigator/compliance/CEO messages
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

    // Check if any staff member (Investigator, Compliance_Officer, or CEO) has posted a public message
    const [staffNotes] = await pool.execute(
      `SELECT note_id FROM investigationnotes
       WHERE case_id = ? AND sender_type IN ('Investigator', 'Compliance_Officer', 'CEO') AND is_internal_only = 0
       LIMIT 1`,
      [caseData.case_id]
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

    // Notify relevant staff about the anonymous reply
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
            message: `An anonymous reporter responded to the Ethics & Anti-Corruption Office on case ${caseInfo[0].reference_id}.`,
            caseId: caseData.case_id,
          });
        }
        if (audienceType === 'CEO') {
          createNotification({
            targetRole: 'CEO',
            type: 'new_message',
            title: 'New Anonymous Reporter Message',
            message: `An anonymous reporter responded to the CEO on case ${caseInfo[0].reference_id}.`,
            caseId: caseData.case_id,
          });
        }
      }
    } catch (_) {}

    const recipientLabel =
      audienceType === 'Compliance_Officer' ? 'Ethics & Anti-Corruption Office' :
      audienceType === 'CEO' ? 'CEO' :
      'Case Investigator';

    return res.status(201).json({
      message: `Your response has been sent to the ${recipientLabel}.`,
    });
  } catch (err) {
    console.error('[NOTE] Anonymous create error:', err.message);
    return res.status(500).json({ error: 'Failed to add response' });
  }
};

/**
 * POST /api/cases/:id/notes
 * Adds a note to the investigation correspondence thread.
 * Audience types: Investigator | Compliance_Officer | CEO | Reporter | General
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

    // If the caller is an anonymous session, ensure it is the session that created the case
    if (identity && identity.type === 'anonymous') {
      const [caseRow] = await pool.execute(`SELECT anon_session_id FROM cases WHERE case_id = ?`, [caseId]);
      if (caseRow.length === 0 || caseRow[0].anon_session_id !== identity.id) {
        return res.status(403).json({ error: 'Access denied: anonymous session not authorized for this case.' });
      }
    }

    // Anonymous reporters cannot post internal notes
    const isInternal = identity.type === 'staff' ? (is_internal_only === true || is_internal_only === 'true') : false;

    // Determine sender_type
    const isStaffReporter = identity.type === 'staff' && ['Employee', 'Branch_Manager'].includes(req.user?.role);
    let senderType;
    if (identity.type === 'staff' && !isStaffReporter) {
      if (req.user?.role === 'Compliance_Officer') senderType = 'Compliance_Officer';
      else if (req.user?.role === 'CEO') senderType = 'CEO';
      else senderType = 'Investigator';
    } else {
      senderType = 'Reporter';
    }

    // Determine audience_type
    // Allowed audience values for staff: Reporter, Investigator, Compliance_Officer, CEO, General
    const VALID_AUDIENCES = ['Reporter', 'Investigator', 'Compliance_Officer', 'CEO', 'General'];
    let audienceType;
    if (senderType === 'Reporter') {
      audienceType = normalizeRecipientRole(recipient_role);
    } else {
      audienceType = (recipient_role && VALID_AUDIENCES.includes(recipient_role))
        ? recipient_role
        : senderType;
    }

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
      metadata: { is_internal_only: isInternal, sender_type: senderType, audience_type: audienceType },
    });

    // Notify relevant parties
    try {
      const [caseInfo] = await pool.execute(
        `SELECT assigned_investigator, reference_id, user_id FROM cases WHERE case_id = ?`,
        [caseId]
      );
      if (caseInfo.length > 0) {
        const ref = caseInfo[0].reference_id;

        if (identity.type === 'staff' && ['Investigator', 'Compliance_Officer', 'CEO'].includes(senderType)) {
          // Notify the reporter if message is public and directed to them
          if (!isInternal && (audienceType === 'Reporter' || audienceType === 'General') && caseInfo[0].user_id) {
            createNotification({
              userId: caseInfo[0].user_id,
              type: 'new_message',
              title: 'New Message on Your Case',
              message: `The ${senderType === 'Compliance_Officer' ? 'Ethics & Anti-Corruption Office' : senderType === 'CEO' ? 'CEO' : 'Case Investigator'} has posted a new message on your case ${ref}.`,
              caseId,
            });
          }

          // Notify Ethics office when investigator posts
          if (senderType === 'Investigator') {
            createNotification({
              targetRole: 'Compliance_Officer',
              type: 'new_message',
              title: 'New Investigator Message',
              message: `The Case Investigator has posted a ${isInternal ? 'private ' : ''}message on case ${ref}.`,
              caseId,
            });
          }

          // Notify investigator when Ethics office posts
          if (senderType === 'Compliance_Officer' && caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Message from Ethics & Anti-Corruption Office',
              message: `The Ethics & Anti-Corruption Office has posted a ${isInternal ? 'private ' : ''}message on case ${ref}.`,
              caseId,
            });
          }

          // Notify Ethics office when CEO posts
          if (senderType === 'CEO') {
            createNotification({
              targetRole: 'Compliance_Officer',
              type: 'new_message',
              title: 'New Message from CEO',
              message: `The CEO has posted a message on case ${ref}.`,
              caseId,
            });
          }

          // Notify CEO when Ethics office directs message to CEO
          if (senderType === 'Compliance_Officer' && audienceType === 'CEO') {
            createNotification({
              targetRole: 'CEO',
              type: 'new_message',
              title: 'New Message from Ethics & Anti-Corruption Office',
              message: `The Ethics & Anti-Corruption Office has sent you a message on case ${ref}.`,
              caseId,
            });
          }

        } else if (identity.type === 'staff' && senderType === 'Reporter') {
          // Staff reporter replied
          if (audienceType === 'Investigator' && caseInfo[0].assigned_investigator) {
            createNotification({
              userId: caseInfo[0].assigned_investigator,
              type: 'new_message',
              title: 'New Reporter Message',
              message: `The reporter on case ${ref} has sent a new message.`,
              caseId,
            });
          }
          if (audienceType === 'Compliance_Officer') {
            createNotification({
              targetRole: 'Compliance_Officer',
              type: 'new_message',
              title: 'New Staff Reporter Message',
              message: `A staff reporter responded to the Ethics & Anti-Corruption Office on case ${ref}.`,
              caseId,
            });
          }
        } else if (identity.type === 'anonymous') {
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
              message: `An anonymous reporter responded to the Ethics & Anti-Corruption Office on case ${ref}.`,
              caseId,
            });
          }
          if (audienceType === 'CEO') {
            createNotification({
              targetRole: 'CEO',
              type: 'new_message',
              title: 'New Anonymous Reporter Message',
              message: `An anonymous reporter responded to the CEO on case ${ref}.`,
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

    const role = req.user?.role;
    const highPriv = identity.type === 'staff' &&
      ['Investigator', 'Compliance_Officer', 'CEO'].includes(role);

    if (identity.type === 'anonymous' || !highPriv) {
      // Reporter: public notes only
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND is_internal_only = 0
               ORDER BY created_at ASC`;
      params = [caseId];
    } else if (role === 'Investigator') {
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND (is_internal_only = 0 OR audience_type IN ('General', 'Investigator') OR sender_type = 'Investigator')
               ORDER BY created_at ASC`;
      params = [caseId];
    } else if (role === 'Compliance_Officer') {
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND (is_internal_only = 0 OR audience_type IN ('General', 'Compliance_Officer', 'CEO') OR sender_type IN ('Compliance_Officer', 'CEO'))
               ORDER BY created_at ASC`;
      params = [caseId];
    } else if (role === 'CEO') {
      query = `SELECT note_id as id, sender_type as author_type, audience_type, note_text as body,
                      is_internal_only, created_at
               FROM investigationnotes
               WHERE case_id = ? AND (is_internal_only = 0 OR audience_type IN ('General', 'CEO', 'Compliance_Officer') OR sender_type IN ('CEO', 'Compliance_Officer'))
               ORDER BY created_at ASC`;
      params = [caseId];
    } else {
      // High-privilege or other staff: all notes
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
