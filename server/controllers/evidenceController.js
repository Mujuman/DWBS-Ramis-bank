const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const decryptBuffer = (encryptedBuffer, ivHex) => {
  const key = Buffer.from(process.env.FILE_ENC_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
};

/**
 * POST /api/cases/:id/evidence
 * Saves uploaded file metadata to DB.
 */
const uploadEvidence = async (req, res) => {
  const user = req.user || req.identity;
  const caseId = parseInt(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const [cases] = await pool.execute(
      `SELECT case_id FROM cases WHERE case_id = ?`, [caseId]
    );
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Only assigned Investigators may upload evidence per BRD
    if (!user || !user.userId || user.role !== 'Investigator') {
      return res.status(403).json({ error: 'Only an assigned Investigator may upload evidence for a case.' });
    }

    // Verify investigator is assigned to this case
    const [caseCheck] = await pool.execute(
      `SELECT assigned_investigator FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );
    if (caseCheck.length === 0) return res.status(404).json({ error: 'Case not found' });
    if (caseCheck[0].assigned_investigator !== user.userId) {
      return res.status(403).json({ error: 'You can only upload evidence to cases assigned to you.' });
    }

    const uploadedBy = user.userId;
    const fileName = req.processedFile?.originalFilename || req.file.originalname;
    const filePath = req.processedFile?.storedFilename || req.file.filename || req.file.path;
    const encryptionIv = req.processedFile?.encryptionIv || null;
    const mimeType = req.processedFile?.mimetype || req.file.mimetype || 'application/octet-stream';

    await pool.execute(
      `INSERT INTO evidencefiles (case_id, file_name, file_path, encryption_iv, uploaded_by, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [caseId, fileName, filePath, encryptionIv, uploadedBy, mimeType]
    );

    await writeAuditLog({
      userId: uploadedBy,
      caseId,
      action: 'EVIDENCE_UPLOADED',
      metadata: { filename: fileName },
    });

    return res.status(201).json({
      message: 'Evidence uploaded successfully',
      file: { original_filename: fileName },
    });
  } catch (err) {
    console.error('[EVIDENCE] Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to save evidence record' });
  }
};

/**
 * GET /api/cases/:id/evidence
 * Lists evidence files for a case (metadata only).
 * Requires Investigator or Compliance_Officer role.
 */
const listEvidence = async (req, res) => {
  const caseId = parseInt(req.params.id);
  const user = req.user;

  try {
    const [cases] = await pool.execute(
      `SELECT case_id FROM cases WHERE case_id = ?`, [caseId]
    );
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [files] = await pool.execute(
      `SELECT file_id AS id, case_id, file_name AS original_filename,
              file_path, uploaded_by, uploaded_at, mime_type
       FROM evidencefiles
       WHERE case_id = ?
       ORDER BY uploaded_at ASC`,
      [caseId]
    );

    // Authorization: Compliance Officers can view all; Investigators only for their assigned cases; owners may view their own case files
    if (user.role === 'System_Admin') {
      return res.status(403).json({ error: 'Access denied. System Administrators are blocked from evidence lists.' });
    }

    const [caseCheck] = await pool.execute(
      `SELECT assigned_investigator, user_id FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );
    const c = caseCheck[0];
    const isOwner = user && c && c.user_id === user.userId;
    const isAssignedInv = user && c && c.assigned_investigator === user.userId;
    const isComp = user && user.role === 'Compliance_Officer';

    if (!isComp && !isAssignedInv && !isOwner) {
      return res.status(403).json({ error: 'Access denied to evidence for this case.' });
    }

    return res.status(200).json({ evidence: files });
  } catch (err) {
    console.error('[EVIDENCE] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch evidence list' });
  }
};

/**
 * GET /api/cases/:id/evidence/:fileId/download
 * Streams a single evidence file.
 */
const downloadEvidence = async (req, res) => {
  const caseId  = parseInt(req.params.id);
  const fileId  = parseInt(req.params.fileId);
  const user    = req.user;

  try {
    // Get case to check ownership
    const [caseRows] = await pool.execute(
      `SELECT case_id, user_id FROM cases WHERE case_id = ? AND deleted_at IS NULL`,
      [caseId]
    );

    if (caseRows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseRows[0];
    const isOwner = caseData.user_id === user.userId;
    const isAssignedInv = caseData.assigned_investigator === user.userId;
    const isCompliance = user.role === 'Compliance_Officer';

    // Allow access only to owner, assigned Investigator, or Compliance Officer. CEO and System_Admin cannot download evidence.
    if (!isOwner && !isAssignedInv && !isCompliance) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      `SELECT file_id, case_id, file_name, file_path, encryption_iv, mime_type FROM evidencefiles WHERE file_id = ? AND case_id = ?`,
      [fileId, caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evidence file not found' });
    }

    const file = rows[0];
    let filePath = file.file_path;
    
    // Resolve the file path - if it's relative, make it absolute
    if (!path.isAbsolute(filePath)) {
      filePath = path.resolve(UPLOAD_DIR, path.basename(filePath));
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Read encrypted file from disk
    const encryptedBuffer = fs.readFileSync(filePath);
    
    // Decrypt using stored IV
    let decryptedBuffer;
    if (!file.encryption_iv) {
      console.error('[EVIDENCE] Download error: missing encryption IV for file', file.file_id);
      return res.status(500).json({ error: 'Evidence file cannot be decrypted because required metadata is missing. Please re-upload the file.' });
    }

    try {
      decryptedBuffer = decryptBuffer(encryptedBuffer, file.encryption_iv);
    } catch (decryptErr) {
      console.error('[EVIDENCE] Decryption error:', decryptErr.message);
      return res.status(500).json({ error: 'Failed to decrypt file' });
    }

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'EVIDENCE_DOWNLOADED',
      metadata: { file_id: fileId, filename: file.file_name },
    });

    // Use the stored mime type when sending back so the client can preview inline
    const contentType = file.mime_type || 'application/octet-stream';
    const downloadFlag = req.query.download === '1';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', contentType);
    if (downloadFlag) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    } else {
      // Default to inline so browsers can render previewable types
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
    }

    return res.send(decryptedBuffer);
  } catch (err) {
    console.error('[EVIDENCE] Download error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

module.exports = { uploadEvidence, listEvidence, downloadEvidence };
