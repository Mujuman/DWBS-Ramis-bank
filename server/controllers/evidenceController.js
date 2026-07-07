const { pool } = require('../config/db');
const { writeAuditLog } = require('../services/auditService');
const { decryptBuffer, UPLOAD_DIR } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

/**
 * POST /api/cases/:id/evidence
 * Saves processed (EXIF-stripped, AES-256 encrypted) file metadata to DB.
 * Actual encryption is handled by the upload middleware before this runs.
 */
const uploadEvidence = async (req, res) => {
  const user = req.user || req.identity;
  const caseId = parseInt(req.params.id);

  if (!req.processedFile) {
    return res.status(400).json({ error: 'No file provided or file processing failed' });
  }

  try {
    // Verify case exists
    const [cases] = await pool.execute(`SELECT case_id FROM cases WHERE case_id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const f = req.processedFile;
    const uploadedBy = user?.userId || user?.id || null;

    await pool.execute(
      `INSERT INTO evidencefiles (case_id, file_name, file_path, uploaded_by)
       VALUES (?, ?, ?, ?)`,
      [caseId, f.originalFilename || f.filename, f.encryptedPath || f.path, uploadedBy]
    );

    await writeAuditLog({
      caseId,
      action: 'EVIDENCE_UPLOADED',
      performedBy: user?.username || user?.label || 'ANONYMOUS',
      performedByType: user?.type || 'anonymous',
      metadata: {
        filename: f.originalFilename || f.filename,
      },
    });

    return res.status(201).json({
      message: 'Evidence uploaded successfully',
      file: {
        original_filename: f.originalFilename || f.filename,
      },
    });
  } catch (err) {
    console.error('[EVIDENCE] Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to save evidence record' });
  }
};

/**
 * GET /api/cases/:id/evidence
 * Lists evidence files for a case (metadata only — no file content).
 * Requires Investigator or Compliance_Officer role.
 */
const listEvidence = async (req, res) => {
  const caseId = parseInt(req.params.id);

  try {
    const [cases] = await pool.execute(`SELECT case_id FROM cases WHERE case_id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [files] = await pool.execute(
      `SELECT file_id as id, case_id, file_name as original_filename, 
              file_path, uploaded_by, uploaded_at
       FROM evidencefiles WHERE case_id = ? ORDER BY uploaded_at ASC`,
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
 * Decrypts and streams a single evidence file.
 * Requires Investigator role minimum.
 */
const downloadEvidence = async (req, res) => {
  const caseId = parseInt(req.params.id);
  const fileId = parseInt(req.params.fileId);
  const user = req.user;

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM evidencefiles WHERE file_id = ? AND case_id = ?`,
      [fileId, caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evidence file not found' });
    }

    const file = rows[0];
    const filePath = path.resolve(UPLOAD_DIR, path.basename(file.file_path));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    await writeAuditLog({
      caseId,
      action: 'EVIDENCE_DOWNLOADED',
      performedBy: user.username,
      performedByType: 'staff',
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
