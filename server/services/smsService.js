const { sendSMS } = require('../config/sms');

/**
 * High-level SMS notification templates using UCS2 encoding for native Amharic.
 * Ensure no PII is included in the SMS content.
 */
const smsService = {
  /**
   * Sends a case status update SMS to the reporter.
   * Amharic Translate: "ክስዎ ሁኔታ ተቀይሯል። እባክዎ በፖርታሉ ላይ ይመልከቱ።" (Your case status has changed. Please check the portal.)
   */
  async notifyStatusChange(phoneNumber, newStatus) {
    const amharicMessage = `የሪፖርትዎ ሁኔታ ወደ ${newStatus} ተቀይሯል። እባክዎ DWBS ፖርታልን ይከታተሉ።`;
    try {
      await sendSMS(phoneNumber, amharicMessage);
    } catch (err) {
      console.error('[SMS SERVICE] Failed to send status change SMS:', err.message);
    }
  },

  /**
   * Sends case submission confirmation to the reporter.
   * Amharic Translate: "ሪፖርትዎ በተሳካ ሁኔታ ገብቷል። መከታተያ ኮድዎ: " (Your report is submitted successfully. Track code: )
   */
  async notifySubmission(phoneNumber, referenceId) {
    const amharicMessage = `ሪፖርትዎ በተሳካ ሁኔታ ገብቷል። መከታተያ ኮድዎ: ${referenceId} ነው።`;
    try {
      await sendSMS(phoneNumber, amharicMessage);
    } catch (err) {
      console.error('[SMS SERVICE] Failed to send submission SMS:', err.message);
    }
  }
};

module.exports = smsService;
