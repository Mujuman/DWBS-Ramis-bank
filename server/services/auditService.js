const { auditPool } = require('../config/db');
const { hashIP } = require('../utils/tokenUtils');

/**
 * Writes an immutable audit log entry.
 * Uses the restricted dwbs_audit_user (INSERT-only privilege).
 *
 * @param {Object} params
 * @param {number|null} params.userId - Associated staff user_id (NULL for anonymous/system)
 * @param {string} params.action - Action code e.g. 'CASE_CREATED', 'STATUS_CHANGED'
 * @param {number|null} params.caseId - Target case ID (case_id)
 * @param {Object|null} params.metadata - Structured context to store in details
 * @param {string|null} params.rawIp - Raw IP (hashed before storage)
 */
const writeAuditLog = async ({
  userId = null,
  action,
  caseId = null,
  metadata = null,
  rawIp = null,
  performedByRole = null,
}) => {
  try {
    if (performedByRole !== 'CEO') {
      return;
    }

    const ipHash = rawIp ? hashIP(rawIp) : null;

    // Strip PII from metadata
    const safeMetadata = metadata ? sanitizeMetadata(metadata) : {};
    
    // Add hashed IP and audit context to details text block
    const detailsObj = {
      ...safeMetadata,
      ip_hash: ipHash,
      performed_at: new Date().toISOString()
    };

    await auditPool.execute(
      `INSERT INTO auditlogs (user_id, action, target_case_id, details)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        action,
        caseId,
        JSON.stringify(detailsObj),
      ]
    );
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
};

/**
 * Strips known PII field names from metadata objects before audit insertion.
 */
const PII_BLACKLIST = [
  'description', 'body', 'email', 'phone', 'name', 'display_name',
  'address', 'password', 'token', 'content', 'message', 'note'
];

const sanitizeMetadata = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_BLACKLIST.some(banned => key.toLowerCase().includes(banned))) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
};

module.exports = { writeAuditLog };
