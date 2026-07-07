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
  } catch (err) {
    console.error('[DB] Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, auditPool, testConnection };
