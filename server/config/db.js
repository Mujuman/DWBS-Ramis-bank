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
      console.error('[DB] Schema migration check failed for manager_help_requested:', migErr.message);
    }

    // Automatic schema migration: check and add deleted_at column
    try {
      const [columns] = await pool.execute("SHOW COLUMNS FROM cases LIKE 'deleted_at'");
      if (columns.length === 0) {
        await pool.execute("ALTER TABLE cases ADD COLUMN deleted_at timestamp NULL DEFAULT NULL");
        console.log('[DB] Migration: Added deleted_at column to cases table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration check failed for deleted_at:', migErr.message);
    }

    // Automatic schema migration: check and add encryption_iv to evidencefiles
    try {
      const [columns] = await pool.execute("SHOW COLUMNS FROM evidencefiles LIKE 'encryption_iv'");
      if (columns.length === 0) {
        await pool.execute("ALTER TABLE evidencefiles ADD COLUMN encryption_iv varchar(64) DEFAULT NULL");
        console.log('[DB] Migration: Added encryption_iv column to evidencefiles table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration check failed for evidencefiles.encryption_iv:', migErr.message);
    }

    // Automatic schema migration: check and add mime_type to evidencefiles
    try {
      const [columns] = await pool.execute("SHOW COLUMNS FROM evidencefiles LIKE 'mime_type'");
      if (columns.length === 0) {
        await pool.execute("ALTER TABLE evidencefiles ADD COLUMN mime_type varchar(100) DEFAULT NULL");
        console.log('[DB] Migration: Added mime_type column to evidencefiles table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration check failed for evidencefiles.mime_type:', migErr.message);
    }

    // Automatic schema migration: add anon_session_id to cases for anonymous session binding
    try {
      const [cols] = await pool.execute("SHOW COLUMNS FROM cases LIKE 'anon_session_id'");
      if (cols.length === 0) {
        await pool.execute("ALTER TABLE cases ADD COLUMN anon_session_id int(11) DEFAULT NULL");
        console.log('[DB] Migration: Added anon_session_id column to cases table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration check failed for cases.anon_session_id:', migErr.message);
    }

    // Automatic schema migration: create notifications table
    try {
      const [tables] = await pool.execute("SHOW TABLES LIKE 'notifications'");
      if (tables.length === 0) {
        await pool.execute(`
          CREATE TABLE notifications (
            notification_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            target_role VARCHAR(50) NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT,
            case_id INT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notif_user (user_id),
            INDEX idx_notif_role (target_role),
            INDEX idx_notif_read (is_read),
            INDEX idx_notif_created (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('[DB] Migration: Created notifications table');
      }
    } catch (migErr) {
      console.error('[DB] Schema migration failed for notifications table:', migErr.message);
    }
  } catch (err) {
    console.error('[DB] Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, auditPool, testConnection };
