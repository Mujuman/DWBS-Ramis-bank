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
 * Returns the most recent notifications for the logged-in user.
 * Matches on user_id OR target_role matching the user's role.
 * Returns up to 30 most recent, newest first.
 */
const getNotifications = async (req, res) => {
  const user = req.user;

  try {
    const [notifications] = await pool.execute(
      `SELECT n.notification_id AS id, n.type, n.title, n.message,
              n.case_id, n.is_read, n.created_at
       FROM notifications n
       WHERE (n.user_id = ? OR n.target_role = ?)
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [user.userId, user.role]
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
 * plus a breakdown by category (cases vs messages vs other).
 * This allows the frontend to display rich badge info.
 */
const getUnreadCount = async (req, res) => {
  const user = req.user;

  try {
    const [[result]] = await pool.execute(
      `SELECT
         COUNT(*) AS count,
         SUM(type IN ('new_case', 'case_assigned', 'case_escalated', 'status_change')) AS unread_cases,
         SUM(type = 'new_message') AS unread_messages
       FROM notifications
       WHERE (user_id = ? OR target_role = ?) AND is_read = 0`,
      [user.userId, user.role]
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
 * Marks a single notification as read.
 */
const markAsRead = async (req, res) => {
  const user = req.user;
  const notifId = parseInt(req.params.id);

  try {
    await pool.execute(
      `UPDATE notifications SET is_read = 1
       WHERE notification_id = ? AND (user_id = ? OR target_role = ?)`,
      [notifId, user.userId, user.role]
    );

    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('[NOTIFICATION] Mark read error:', err.message);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
};

// ── PATCH /api/notifications/read-all ─────────────────────────
/**
 * Marks all notifications as read for the current user.
 */
const markAllAsRead = async (req, res) => {
  const user = req.user;

  try {
    await pool.execute(
      `UPDATE notifications SET is_read = 1
       WHERE (user_id = ? OR target_role = ?) AND is_read = 0`,
      [user.userId, user.role]
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
