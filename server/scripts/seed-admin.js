/**
 * seed-admin.js
 * Run once to set the default sysadmin password hash in the database.
 * Usage: node scripts/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seedAdmin() {
  const password = 'Admin@Rammis2025!';
  const hash = await bcrypt.hash(password, 12);

  const [result] = await pool.execute(
    `UPDATE users SET password_hash = ? WHERE username = 'sysadmin'`,
    [hash]
  );

  if (result.affectedRows === 0) {
    // Insert the row if it doesn't exist yet
    await pool.execute(
      `INSERT INTO users (username, email, password_hash, role, department, is_active)
       VALUES ('sysadmin', 'sysadmin@rammisbank.et', ?, 'System_Admin', 'IT_Security', 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [hash]
    );
    console.log('[SEED] sysadmin user created and password set.');
  } else {
    console.log('[SEED] sysadmin password hash updated successfully.');
  }

  console.log('[SEED] Username : sysadmin');
  console.log('[SEED] Password : Admin@Rammis2025!');
  console.log('[SEED] Hash     :', hash);

  await pool.end();
}

seedAdmin().catch(err => {
  console.error('[SEED] Error:', err.message);
  process.exit(1);
});
