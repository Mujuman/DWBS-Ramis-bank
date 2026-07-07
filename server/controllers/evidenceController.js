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
    const [cases] = await pool.execute(`SELECT id FROM Cases WHERE id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const f = req.processedFile;

    await pool.execute(
      `INSERT INTO EvidenceFiles
        (case_id, original_filename, stored_filename, encrypted_path, encryption_iv, mime_type, file_size_bytes, exif_stripped)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [caseId, f.originalFilename, f.storedFilename, f.encryptedPath, f.encryptionIv, f.mimeType, f.fileSizeBytes, f.exifStripped ? 1 : 0]
    );

    await writeAuditLog({
      caseId,
      action: 'EVIDENCE_UPLOADED',
      performedBy: user?.username || user?.label || 'ANONYMOUS',
      performedByType: user?.type || 'anonymous',
      metadata: {
        mime_type: f.mimeType,
        file_size_bytes: f.fileSizeBytes,
        exif_stripped: f.exifStripped,
      },
    });

    return res.status(201).json({
      message: 'Evidence uploaded and secured successfully',
      file: {
        original_filename: f.originalFilename,
        mime_type: f.mimeType,
        size_bytes: f.fileSizeBytes,
        exif_stripped: f.exifStripped,
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
    const [cases] = await pool.execute(`SELECT id FROM Cases WHERE id = ?`, [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [files] = await pool.execute(
      `SELECT id, case_id, original_filename, mime_type, file_size_bytes, exif_stripped, uploaded_at
       FROM EvidenceFiles WHERE case_id = ? ORDER BY uploaded_at ASC`,
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
      `SELECT * FROM EvidenceFiles WHERE id = ? AND case_id = ?`,
      [fileId, caseId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Evidence file not found' });
    }

    const file = rows[0];
    const encPath = path.resolve(UPLOAD_DIR, path.basename(file.stored_filename));

    if (!fs.existsSync(encPath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const encryptedBuffer = fs.readFileSync(encPath);
    const decryptedBuffer = decryptBuffer(encryptedBuffer, file.encryption_iv);

    await writeAuditLog({
      caseId,
      action: 'EVIDENCE_DOWNLOADED',
      performedBy: user.username,
      performedByType: 'staff',
      metadata: { file_id: fileId, mime_type: file.mime_type },
    });

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(decryptedBuffer);
  } catch (err) {
    console.error('[EVIDENCE] Download error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

module.exports = { uploadEvidence, listEvidence, downloadEvidence };
