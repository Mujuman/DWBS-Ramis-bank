const { pool } = require('../config/db');

// ── Helper: Create Notification ───────────────────────────────
/**
 * Creates a notification record. Can target a specific user_id
 * OR broadcast to all users of a given role via target_role.
 *
 * @param {Object} opts
 * @param {number|null}  opts.userId     - Specific user to notify (null for role-broadcast)
 * @param {string|null}  opts.targetRole - Role to broadcast to (e.g. 'Compliance_Officer')
 * @param {string}       opts.type       - 'new_case' | 'case_assigned' | 'new_message' | 'case_escalated' | 'status_change'
 * @param {string}       opts.title      - Short title for the notification
 * @param {string}       opts.message    - Longer description
 * @param {number|null}  opts.caseId     - Related case ID (for navigation)
 */
const createNotification = async ({ userId = null, targetRole = null, type, title, message, caseId = null }) => {
  try {
    await pool.execute(
      `INSERT INTO notifications (user_id, target_role, type, title, message, case_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, targetRole, type, title, message, caseId]
    );
  } catch (err) {
    // Notification creation should never break the main flow
    console.error('[NOTIFICATION] Create error:', err.message);
  }
};

// ── GET /api/notifications ────────────────────────────────────
/**
 * Returns the most recent 30 notifications for the logged-in user.
 * A notification is "unread" if there is NO entry in notification_reads
 * for this user + notification_id.
 * This allows per-user read state even for role-broadcast notifications.
 */
const getNotifications = async (req, res) => {
  const user = req.user;

  try {
    const [notifications] = await pool.execute(
      `SELECT
         n.notification_id AS id,
         n.type,
         n.title,
         n.message,
         n.case_id,
         n.created_at,
         CASE WHEN nr.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_read
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.notification_id AND nr.user_id = ?
       WHERE (n.user_id = ? OR n.target_role = ?)
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [user.userId, user.userId, user.role]
    );

    return res.status(200).json({ notifications });
  } catch (err) {
    console.error('[NOTIFICATION] List error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// ── GET /api/notifications/count ──────────────────────────────
/**
 * Lightweight endpoint for polling — returns the total unread count
 * plus a breakdown by category (cases vs messages).
 * Uses notification_reads for per-user read state.
 */
const getUnreadCount = async (req, res) => {
  const user = req.user;

  try {
    const [[result]] = await pool.execute(
      `SELECT
         COUNT(*) AS count,
         SUM(n.type IN ('new_case', 'case_assigned', 'case_escalated', 'status_change')) AS unread_cases,
         SUM(n.type = 'new_message') AS unread_messages
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.notification_id AND nr.user_id = ?
       WHERE (n.user_id = ? OR n.target_role = ?)
         AND nr.user_id IS NULL`,
      [user.userId, user.userId, user.role]
    );

    return res.status(200).json({
      count: result.count || 0,
      unread_cases: result.unread_cases || 0,
      unread_messages: result.unread_messages || 0,
    });
  } catch (err) {
    console.error('[NOTIFICATION] Count error:', err.message);
    return res.status(200).json({ count: 0, unread_cases: 0, unread_messages: 0 });
  }
};

// ── PATCH /api/notifications/:id/read ─────────────────────────
/**
 * Marks a single notification as read for the current user
 * by inserting a record into notification_reads.
 */
const markAsRead = async (req, res) => {
  const user = req.user;
  const notifId = parseInt(req.params.id);

  try {
    // INSERT IGNORE so re-marking read is a no-op
    await pool.execute(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)`,
      [notifId, user.userId]
    );

    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[NOTIFICATION] Mark read error:', err.message);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

// ── PATCH /api/notifications/read-all ─────────────────────────
/**
 * Marks all current notifications as read for the logged-in user
 * by bulk-inserting into notification_reads.
 */
const markAllAsRead = async (req, res) => {
  const user = req.user;

  try {
    // Insert read records for every notification this user can see
    // that they haven't already read. INSERT IGNORE prevents duplicates.
    await pool.execute(
      `INSERT IGNORE INTO notification_reads (notification_id, user_id)
       SELECT n.notification_id, ?
       FROM notifications n
       LEFT JOIN notification_reads nr
         ON nr.notification_id = n.notification_id AND nr.user_id = ?
       WHERE (n.user_id = ? OR n.target_role = ?)
         AND nr.user_id IS NULL`,
      [user.userId, user.userId, user.userId, user.role]
    );

    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[NOTIFICATION] Mark all read error:', err.message);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
