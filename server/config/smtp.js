const nodemailer = require('nodemailer');
require('dotenv').config();

// Persistent transporter — reuses the same SMTP connection pool
// instead of opening a new TCP connection on every email send
let _transporter = null;

const getTransporter = () => {
  // Strip all whitespace from password in case it was pasted with spaces
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

  if (!gmailUser || !gmailPass) return null;

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,           // keep a pool of SMTP connections open
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }
  return _transporter;
};

/**
 * Sends an email via Gmail SMTP using a persistent connection pool.
 * Never throws — errors are logged and null is returned on failure.
 *
 * @param {Object} opts - { to, subject, text, html }
 * @returns {Promise<Object|null>}
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.error('[SMTP] GMAIL_USER or GMAIL_APP_PASSWORD not set in .env — email not sent');
    return null;
  }

  try {
    const gmailUser = process.env.GMAIL_USER;
    const info = await transporter.sendMail({
      from: `"Rammis Bank DWBS" <${gmailUser}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('[SMTP] Email sent to', to, '| MessageId:', info.messageId);
    return info;
  } catch (err) {
    // Reset transporter on auth or connection errors so next call retries fresh
    if (/auth|credentials|connection|timeout/i.test(err.message)) {
      _transporter = null;
    }
    console.error('[SMTP] Failed to send email to', to, ':', err.message);
    return null;
  }
};

module.exports = { sendEmail };
