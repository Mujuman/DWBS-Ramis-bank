const { pool } = require('./config/db');

async function fixEmptyStatuses() {
  try {
    const [result] = await pool.execute(
      `UPDATE cases SET status = 'New', updated_at = NOW() WHERE (status = '' OR status IS NULL) AND deleted_at IS NULL`
    );
    console.log('Fixed empty status rows:', result.affectedRows);

    // Also show all escalated cases
    const [escalated] = await pool.execute(
      `SELECT case_id, reference_id, category, is_escalated, severity_level, status FROM cases WHERE is_escalated = 1 AND deleted_at IS NULL`
    );
    console.log('Escalated cases:', JSON.stringify(escalated, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixEmptyStatuses();
