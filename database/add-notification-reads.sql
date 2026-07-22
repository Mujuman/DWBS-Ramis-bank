-- Migration: Per-user notification read tracking
-- Run this once against rammis_dwbs_db if the notification_reads table does not exist.
-- The server auto-migration in db.js will also create it on next restart.

USE rammis_dwbs_db;

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INT NOT NULL,
  user_id         INT NOT NULL,
  read_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id, user_id),
  INDEX idx_notif_read_user  (user_id),
  INDEX idx_notif_read_notif (notification_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Back-fill: mark all existing notifications as already read for every user
-- so old noise doesn't re-appear as unread after the migration.
-- Safe to skip if you want users to see all past notifications as unread.
-- INSERT IGNORE INTO notification_reads (notification_id, user_id)
-- SELECT n.notification_id, u.user_id
-- FROM notifications n
-- CROSS JOIN users u
-- WHERE (n.user_id = u.user_id OR n.target_role = u.role);
