/**
 * Compliance-aligned case workflow for Rammis Bank DWBS.
 * Maps to the A&RC whistleblowing procedure.
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

const STATUS_TRANSITIONS = {
  New: { Compliance_Officer: ['Under_Review'] },
  Under_Review: { Compliance_Officer: ['Complaint_Dismissed', 'Assigned'] },
  Assigned: { Investigator: ['Investigating'] },
  Investigating: { Investigator: ['Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'] },
  Pending_Evidence: { Investigator: ['Investigating', 'Substantiated', 'Dismissed_No_Evidence'] },
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
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  isTerminalStatus,
  getAllowedStatusesForRole,
  validateStatusTransition,
  getNextStatusesForRole,
};
