const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Creates a Gmail transporter on demand so env vars are
 * guaranteed to be loaded before the transport is built.
 */
const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

/**
 * Sends an email via Gmail SMTP (App Password auth).
 * Never crashes the calling code — errors are logged only.
 *
 * @param {Object} opts - { to, subject, text, html }
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.error('[SMTP] GMAIL_USER or GMAIL_APP_PASSWORD not set in .env — email not sent');
    return null;
  }

  try {
    const transporter = createTransporter();
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
    console.error('[SMTP] Failed to send email to', to, ':', err.message);
    return null;
  }
};

module.exports = { sendEmail };
