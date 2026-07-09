const { sendEmail } = require('../config/smtp');

/**
 * Notification templates for DWBS events.
 *
 * PRIVACY RULE: Emails must NEVER include:
 * - Case descriptions or report content
 * - Reporter identity information
 * - Specific case reference IDs (use generic notification language)
 * - Investigator names or contact details in reporter-facing emails
 *
 * Only generic status update messages are permitted.
 */

const emailService = {
  /**
   * Notifies the compliance team that a new case has been submitted.
   * Sent to internal staff only — never to the reporter.
   */
  async notifyNewCaseToCompliance(complianceEmail) {
    await sendEmail({
      to: complianceEmail,
      subject: '[DWBS] New Whistleblowing Report Submitted',
      text: `A new report has been submitted to the Digital Whistleblowing System. Please log in to the DWBS portal to review and assign this case.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #0A1D37; padding: 20px; text-align: center;">
            <h2 style="color: #F9A826; margin: 0;">Rammis Bank DWBS</h2>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>A new whistleblowing report has been submitted to the Digital Whistleblowing System.</p>
            <p>Please log in to the DWBS portal to review and assign this case to an investigator.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_ORIGIN}/login"
                 style="background: #0A1D37; color: #F9A826; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Access DWBS Portal
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              This is an automated notification. Do not reply to this email.<br>
              Rammis Bank — Digital Whistleblowing System
            </p>
          </div>
        </div>
      `,
    });
  },

  /**
   * Notifies an investigator that a case has been assigned to them.
   */
  async notifyAssignment(investigatorEmail) {
    await sendEmail({
      to: investigatorEmail,
      subject: '[DWBS] Case Assigned to You',
      text: `A case has been assigned to you in the DWBS. Please log in to review and begin investigation.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #0A1D37; padding: 20px; text-align: center;">
            <h2 style="color: #F9A826; margin: 0;">Rammis Bank DWBS</h2>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>A whistleblowing case has been assigned to you for investigation.</p>
            <p>Please log in to the DWBS portal to begin your investigation.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_ORIGIN}/login"
                 style="background: #0A1D37; color: #F9A826; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View My Cases
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              This is an automated notification. Do not reply to this email.<br>
              Rammis Bank — Digital Whistleblowing System
            </p>
          </div>
        </div>
      `,
    });
  },

  async notifyCEOEscalation(ceoEmail, details = {}) {
    await sendEmail({
      to: ceoEmail,
      subject: '[DWBS] Critical Case Escalation for CEO Review',
      text: `A critical whistleblowing case has been escalated to executive review. Please log in to the DWBS portal to view executive dashboard details.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #0A1D37; padding: 20px; text-align: center;">
            <h2 style="color: #F9A826; margin: 0;">Rammis Bank DWBS</h2>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>A case has been marked as <strong>Critical</strong> and escalated to executive review.</p>
            ${details.reference_id ? `<p>Reference: ${details.reference_id}</p>` : ''}
            ${details.category ? `<p>Category: ${details.category.replace(/_/g, ' ')}</p>` : ''}
            <p>Please log in to the DWBS portal to view the executive dashboard.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_ORIGIN}/executive"
                 style="background: #0A1D37; color: #F9A826; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Executive Dashboard
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              This is an automated notification. Do not reply to this email.<br>
              Rammis Bank — Digital Whistleblowing System
            </p>
          </div>
        </div>
      `,
    });
  },

  /**
   * Notifies a reporter (if they provided contact) that their case status changed.
   * Status label is generic — no specifics about the investigation.
   */
  async notifyReporterStatusChange(reporterEmail, newStatus) {
    const statusLabels = {
      Under_Review: 'is being analysed by the Compliance Team',
      Assigned: 'has been validated and assigned for investigation',
      Investigating: 'is being actively investigated',
      Pending_Evidence: 'requires additional information via the portal',
      Substantiated: 'has been substantiated and referred for appropriate action',
      Complaint_Dismissed: 'has been reviewed and closed',
      Dismissed_No_Evidence: 'has been closed due to insufficient evidence',
    };
    const label = statusLabels[newStatus] || 'has been updated';

    await sendEmail({
      to: reporterEmail,
      subject: '[DWBS] Your Report Status Update',
      text: `Your whistleblowing report ${label}. You may check the portal for any correspondence from the investigation team.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #0A1D37; padding: 20px; text-align: center;">
            <h2 style="color: #F9A826; margin: 0;">Rammis Bank DWBS</h2>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>Your whistleblowing report <strong>${label}</strong>.</p>
            <p>You may check the portal for any correspondence from the investigation team using your original reference code.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_ORIGIN}/track"
                 style="background: #0A1D37; color: #F9A826; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Check Report Status
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              This is an automated notification. Do not reply to this email.<br>
              Rammis Bank — Digital Whistleblowing System
            </p>
          </div>
        </div>
      `,
    });
  },

  /**
   * Notifies A&RC (via Compliance Team Lead) when a valid complaint is assigned
   * or when an investigation concludes with a substantiated finding.
   */
  async notifyAARCReferral(recipientEmail, details = {}) {
    const isSubstantiated = details.stage === 'substantiated';
    const subject = isSubstantiated
      ? '[DWBS] Substantiated Case — A&RC Action Required'
      : '[DWBS] Valid Complaint Referred to A&RC';

    const bodyText = isSubstantiated
      ? 'An investigation has concluded with a substantiated finding. Please log in to the DWBS portal to review and initiate appropriate disciplinary or legal action.'
      : 'A whistleblowing complaint has been validated and referred to A&RC. A Case Investigator has been assigned to gather facts and analyse evidence.';

    await sendEmail({
      to: recipientEmail,
      subject,
      text: bodyText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <div style="background: #0A1D37; padding: 20px; text-align: center;">
            <h2 style="color: #F9A826; margin: 0;">Rammis Bank DWBS — A&RC Referral</h2>
          </div>
          <div style="padding: 30px; background: #f8f9fa;">
            <p>${bodyText}</p>
            ${details.reference_id ? `<p><strong>Reference:</strong> ${details.reference_id}</p>` : ''}
            ${details.category ? `<p><strong>Category:</strong> ${details.category.replace(/_/g, ' ')}</p>` : ''}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_ORIGIN}/login"
                 style="background: #0A1D37; color: #F9A826; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Access DWBS Portal
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">
              This is an automated notification. Do not reply to this email.<br>
              Rammis Bank — Digital Whistleblowing System
            </p>
          </div>
        </div>
      `,
    });
  },
};

module.exports = emailService;
