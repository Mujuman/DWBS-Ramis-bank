/**
 * Compliance-aligned case workflow for Rammis Bank DWBS.
 *
 * Flow:
 *  User (anonymous or non-anonymous)
 *    → Ethics & Anti-Corruption Office (Compliance_Officer)
 *        → [Critical] Escalates to CEO
 *            → CEO assigns Investigator
 *        → [Non-Critical] Compliance Officer assigns Investigator directly
 *    → Investigator investigates
 */

const CASE_STATUSES = [
  'New',
  'Under_Review',
  'Complaint_Dismissed',
  'Assigned',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
];

const TERMINAL_STATUSES = ['Complaint_Dismissed', 'Substantiated', 'Dismissed_No_Evidence'];

const COMPLIANCE_OFFICER_STATUSES = ['Under_Review', 'Complaint_Dismissed', 'Assigned'];

const INVESTIGATOR_STATUSES = ['Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'];

// CEO can assign investigators on escalated/critical cases reported by Ethics Office
const CEO_STATUSES = ['Assigned'];

const STATUS_TRANSITIONS = {
  New: {
    Compliance_Officer: ['Under_Review', 'Complaint_Dismissed', 'Assigned'],
    CEO: ['Assigned'],
  },
  Under_Review: {
    Compliance_Officer: ['Complaint_Dismissed', 'Assigned'],
    CEO: ['Assigned'],
  },
  Assigned: {
    Investigator: ['Investigating'],
    // EAAC can re-assign, revert to review, or dismiss at any point
    Compliance_Officer: ['Under_Review', 'Complaint_Dismissed', 'Assigned'],
    CEO: ['Assigned'],
  },
  Investigating: {
    Investigator: ['Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'],
    // EAAC can re-assign, revert, or dismiss while investigation is ongoing
    Compliance_Officer: ['Under_Review', 'Assigned', 'Complaint_Dismissed'],
    CEO: ['Assigned'],
  },
  Pending_Evidence: {
    Investigator: ['Investigating', 'Substantiated', 'Dismissed_No_Evidence'],
    // EAAC can re-assign, revert to review, or dismiss when evidence is pending
    Compliance_Officer: ['Under_Review', 'Assigned', 'Complaint_Dismissed'],
    CEO: ['Assigned'],
  },
};

const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Complaint_Dismissed: 'Complaint Dismissed',
  Assigned: 'Refer to A&RC / Assign to Case Investigator',
  Investigating: 'Gather Facts and Analyze Evidence',
  Pending_Evidence: 'Pending Evidence',
  Substantiated: 'Substantiated (በማስረጃ የተረጋገጠ)',
  Dismissed_No_Evidence: 'Dismissed due to Lack of Evidence',
};

const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

const getAllowedStatusesForRole = (role) => {
  if (role === 'Compliance_Officer') return COMPLIANCE_OFFICER_STATUSES;
  if (role === 'Investigator') return INVESTIGATOR_STATUSES;
  if (role === 'CEO') return CEO_STATUSES;
  return [];
};

const validateStatusTransition = (role, currentStatus, newStatus) => {
  if (currentStatus === newStatus) return null;
  if (isTerminalStatus(currentStatus)) {
    return `Case is closed (${STATUS_LABELS[currentStatus]}). No further status changes are permitted.`;
  }

  const allowedForRole = STATUS_TRANSITIONS[currentStatus]?.[role];
  if (!allowedForRole || !allowedForRole.includes(newStatus)) {
    return `Invalid transition from "${STATUS_LABELS[currentStatus] || currentStatus}" to "${STATUS_LABELS[newStatus] || newStatus}" for your role.`;
  }

  return null;
};

const getNextStatusesForRole = (role, currentStatus) => {
  if (isTerminalStatus(currentStatus)) return [];
  return STATUS_TRANSITIONS[currentStatus]?.[role] || [];
};


module.exports = {
  CASE_STATUSES,
  TERMINAL_STATUSES,
  COMPLIANCE_OFFICER_STATUSES,
  INVESTIGATOR_STATUSES,
  CEO_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  isTerminalStatus,
  getAllowedStatusesForRole,
  validateStatusTransition,
  getNextStatusesForRole,
};
