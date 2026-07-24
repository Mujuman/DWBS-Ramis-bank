/**
 * Compliance-aligned case workflow — mirrors server/constants/caseWorkflow.js
 *
 * Flow:
 *  User (anonymous or non-anonymous)
 *    → Ethics & Anti-Corruption Office (Compliance_Officer)
 *        → [Critical] Escalates to CEO → CEO assigns handler
 *        → [Non-Critical] Compliance Officer manages case directly
 *    → Case investigated by Compliance Officer → Substantiated / Dismissed
 */

export const CASE_STATUSES = [
  'New',
  'Under_Review',
  'Complaint_Dismissed',
  'Assigned',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
];

export const TERMINAL_STATUSES = ['Complaint_Dismissed', 'Substantiated', 'Dismissed_No_Evidence'];

export const COMPLIANCE_OFFICER_STATUSES = [
  'New',
  'Under_Review',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
];

// CEO can only assign handler on escalated cases (Critical) reported by Ethics Office
export const CEO_STATUSES = ['Assigned'];

export const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Investigating: 'Gather Facts and Analyze Evidence',
  Pending_Evidence: 'Pending Evidence',
  Substantiated: 'Substantiated (በማስረጃ የተረጋገጠ)',
  Dismissed_No_Evidence: 'Dismissed due to Lack of Evidence',
};

export const STATUS_BADGE = {
  New: 'badge-new',
  Under_Review: 'badge-review',
  Complaint_Dismissed: 'badge-closed',
  Assigned: 'badge-review',
  Investigating: 'badge-progress',
  Pending_Evidence: 'badge-escalated',
  Substantiated: 'badge-resolved',
  Dismissed_No_Evidence: 'badge-closed',
};

export const TRACK_TIMELINE = [
  'New',
  'Under_Review',
  'Assigned',
  'Investigating',
  'Substantiated',
];

export const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

export const getNextStatusesForRole = (role, currentStatus) => {
  // If status is empty/null (new case), return all allowed statuses for the role
  if (!currentStatus || currentStatus.trim() === '') {
    if (role === 'Compliance_Officer') return COMPLIANCE_OFFICER_STATUSES;
    if (role === 'CEO') return CEO_STATUSES;
    return [];
  }

  const transitions = {
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

  // EAAC can also transition out of terminal statuses (reopen/override a closed case)
  if (isTerminalStatus(currentStatus)) {
    if (role === 'Compliance_Officer') {
      return ['Investigating', 'Pending_Evidence'];  // Can only reopen to investigation
    }
    return [];
  }
  
  return transitions[currentStatus]?.[role] || [];
};

export const formatStatus = (status) =>
  STATUS_LABELS[status] || status?.replace(/_/g, ' ') || status;
