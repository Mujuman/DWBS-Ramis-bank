const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

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
    const fileName = req.file.originalname;
    const filePath = req.file.path || req.file.filename;

    await pool.execute(
      `INSERT INTO evidencefiles (case_id, file_name, file_path, uploaded_by)
       VALUES (?, ?, ?, ?)`,
      [caseId, fileName, filePath, uploadedBy]
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
    const [rows] = await pool.execute(
      `SELECT * FROM evidencefiles WHERE file_id = ? AND case_id = ?`,
      [fileId, caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evidence file not found' });
    }

    const file     = rows[0];
    const filePath = path.resolve(UPLOAD_DIR, path.basename(file.file_path));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    await writeAuditLog({
      userId: user.userId,
      caseId,
      action: 'EVIDENCE_DOWNLOADED',
      metadata: { file_id: fileId, filename: file.file_name },
    });

    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(filePath);
  } catch (err) {
    console.error('[EVIDENCE] Download error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

module.exports = { uploadEvidence, listEvidence, downloadEvidence };
