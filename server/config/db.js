const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'dwbs_rammis',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: parseInt(process.env.DB_POOL_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  charset: 'utf8mb4',
});

// Separate pool for audit logging (INSERT-only user)
const auditPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'dwbs_rammis',
  user: process.env.DB_AUDIT_USER,
  password: process.env.DB_AUDIT_PASSWORD,
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 0,
});

const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL connection pool established successfully');
    conn.release();

    // Automatic schema migration: check and add manager_help_requested column
    try {
      const [columns] = await pool.execute("SHOW COLUMNS FROM cases LIKE 'manager_help_requested'");
      if (columns.length === 0) {
        await pool.execute("ALTER TABLE cases ADD COLUMN manager_help_requested tinyint(1) DEFAULT 0");
        console.log('[DB] Migration: Added manager_help_requested column to cases table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration check failed:', migErr.message);
    }
  } catch (err) {
    console.error('[DB] Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, auditPool, testConnection };
