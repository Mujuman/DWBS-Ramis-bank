/**
 * Compliance-aligned case workflow for Rammis Bank DWBS.
 *
 * Flow:
 *  User (anonymous or non-anonymous)
 *    → Ethics & Anti-Corruption Office (Compliance_Officer)
 *        → [Critical] Escalates to CEO
 *            → CEO assigns Case Handler
 *        → [Non-Critical] Compliance Officer handles or assigns Case Handler directly
 *    → Compliance Team investigates / handles case
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

const COMPLIANCE_OFFICER_STATUSES = [
  'New',
  'Under_Review',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
];

// CEO can assign handler on escalated/critical cases reported by Ethics Office
const CEO_STATUSES = ['Assigned'];

const STATUS_TRANSITIONS = {
  New: {
    Compliance_Officer: ['Under_Review', 'Investigating'],
    CEO: [],
  },
  Under_Review: {
    Compliance_Officer: ['Investigating', 'Pending_Evidence'],
    CEO: [],
  },
  Investigating: {
    Compliance_Officer: ['Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'],
    CEO: [],
  },
  Pending_Evidence: {
    Compliance_Officer: ['Investigating', 'Substantiated', 'Dismissed_No_Evidence'],
    CEO: [],
  },
  Substantiated: {
    Compliance_Officer: ['Investigating'],  // Can reopen if needed
    CEO: [],
  },
  Dismissed_No_Evidence: {
    Compliance_Officer: ['Investigating'],  // Can reopen if needed
    CEO: [],
  },
};

const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Investigating: 'Gather Facts and Analyze Evidence',
  Pending_Evidence: 'Pending Evidence',
  Substantiated: 'Substantiated (በማስረጃ የተረጋገጠ)',
  Dismissed_No_Evidence: 'Dismissed due to Lack of Evidence',
};

const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

const getAllowedStatusesForRole = (role) => {
  if (role === 'Compliance_Officer') return COMPLIANCE_OFFICER_STATUSES;
  if (role === 'CEO') return CEO_STATUSES;
  return [];
};

const validateStatusTransition = (role, currentStatus, newStatus) => {
  console.log('[Workflow Validation]', { role, currentStatus, newStatus });
  
  // Same status - no change needed
  if (currentStatus === newStatus) {
    return null;
  }

  // Compliance Officer can set any allowed status from any state (including empty)
  if (role === 'Compliance_Officer') {
    if (COMPLIANCE_OFFICER_STATUSES.includes(newStatus)) {
      return null;  // Allow all valid statuses
    }
    return `Invalid status "${newStatus}" for Compliance Officer.`;
  }

  // CEO has no status update permissions
  return 'Only the Ethics & Anti-Corruption Office can update case status.';
};

const getNextStatusesForRole = (role, currentStatus) => {
  if (isTerminalStatus(currentStatus)) {
    if (role === 'Compliance_Officer') {
      return ['Investigating', 'Pending_Evidence'];  // Can only reopen to investigation
    }
    return [];
  }
  return STATUS_TRANSITIONS[currentStatus]?.[role] || [];
};

module.exports = {
  CASE_STATUSES,
  TERMINAL_STATUSES,
  COMPLIANCE_OFFICER_STATUSES,
  CEO_STATUSES,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  isTerminalStatus,
  getAllowedStatusesForRole,
  validateStatusTransition,
  getNextStatusesForRole,
};
