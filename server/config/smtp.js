const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Sends an email via Gmail SMTP (App Password auth).
 * Never crashes the calling code — errors are logged only.
 *
 * @param {Object} opts - { to, subject, text, html }
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const gmailUser = process.env.GMAIL_USER;
  // Strip all whitespace from the app password — spaces are invalid but easy to accidentally include
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

  if (!gmailUser || !gmailPass) {
    console.error('[SMTP] GMAIL_USER or GMAIL_APP_PASSWORD not set in .env — email not sent');
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
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
