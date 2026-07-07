const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.BANK_SMTP_HOST,
  port: parseInt(process.env.BANK_SMTP_PORT) || 587,
  secure: false, // STARTTLS — upgrades after initial connection
  requireTLS: true,
  auth: {
    user: process.env.BANK_SMTP_USER,
    pass: process.env.BANK_SMTP_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
});

/**
 * Sends an email notification.
 * IMPORTANT: Never include PII, case descriptions, or reference IDs in subject/body.
 * All email content must be generic status notifications only.
 *
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[SMTP] Dev mode — email not sent. Subject:', subject);
    return { accepted: [to], messageId: 'dev-mock-id' };
  }

  const info = await transporter.sendMail({
    from: process.env.BANK_SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return info;
};

module.exports = { transporter, sendEmail };
