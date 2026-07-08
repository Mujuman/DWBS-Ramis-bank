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

    const uploadedBy = user?.userId || null;
    const fileName = req.processedFile?.originalFilename || req.file.originalname;
    const filePath = req.processedFile?.storedFilename || req.file.filename || req.file.path;
    const encryptionIv = req.processedFile?.encryptionIv || null;

    await pool.execute(
      `INSERT INTO evidencefiles (case_id, file_name, file_path, encryption_iv, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, fileName, filePath, encryptionIv, uploadedBy]
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

  try {
    const [cases] = await pool.execute(
      `SELECT case_id FROM cases WHERE case_id = ?`, [caseId]
    );
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [files] = await pool.execute(
      `SELECT file_id AS id, case_id, file_name AS original_filename,
              file_path, uploaded_by, uploaded_at
       FROM evidencefiles
       WHERE case_id = ?
       ORDER BY uploaded_at ASC`,
      [caseId]
    );

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
    const isPrivileged = ['Investigator', 'Compliance_Officer', 'CEO'].includes(user.role);

    // Allow access if user is owner or privileged role
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [rows] = await pool.execute(
      `SELECT file_id, case_id, file_name, file_path, encryption_iv FROM evidencefiles WHERE file_id = ? AND case_id = ?`,
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

    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.send(decryptedBuffer);
  } catch (err) {
    console.error('[EVIDENCE] Download error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

module.exports = { uploadEvidence, listEvidence, downloadEvidence };
