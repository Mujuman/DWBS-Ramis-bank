const crypto = require('crypto');

/**
 * Generates a cryptographically secure random hex token.
 * Used for anonymous session tokens and reference IDs.
 * @param {number} bytes - Number of random bytes (default 32 = 64 hex chars)
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generates a short, random alphanumeric case reference ID.
 * Uses uppercase letters and numbers, avoiding visually ambiguous chars.
 * Not sequential — safe to expose to reporters.
 * @param {number} length - Character length (default 12)
 */
const generateReferenceId = (length = 12) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
};

/**
 * Computes a one-way SHA-256 hash of an IP address for forensic audit.
 * We never store plain IPs — only hashed values for breach forensics.
 * @param {string} ip - Raw IP address string
 */
const hashIP = (ip) => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + process.env.JWT_ACCESS_SECRET).digest('hex');
};

/**
 * Calculates the expiry datetime for an anonymous session.
 * @returns {Date} - 30 minutes from now in UTC
 */
const getSessionExpiry = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + (parseInt(process.env.ANON_SESSION_EXPIRY_MINUTES) || 30));
  return expiry;
};

module.exports = { generateSecureToken, generateReferenceId, hashIP, getSessionExpiry };
