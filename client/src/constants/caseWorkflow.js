/**
 * Compliance-aligned case workflow — mirrors server/constants/caseWorkflow.js
 *
 * Flow:
 *  User (anonymous or non-anonymous)
 *    → Ethics & Anti-Corruption Office (Compliance_Officer)
 *        → [Critical] Escalates to CEO → CEO assigns Investigator
 *        → [Non-Critical] Compliance Officer assigns Investigator directly
 *    → Investigator investigates → Substantiated / Dismissed
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
  'Assigned',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
  'Complaint_Dismissed',
];

export const INVESTIGATOR_STATUSES = ['Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'];

// CEO can only assign investigator on escalated cases (Critical) reported by Ethics Office
export const CEO_STATUSES = ['Assigned'];

export const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Complaint_Dismissed: 'Complaint Dismissed',
  Assigned: 'Refer to A&RC / Assign to Case Investigator',
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
  const transitions = {
    New: {
      Compliance_Officer: ['Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Under_Review: {
      Compliance_Officer: ['New', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Assigned: {
      Investigator: ['Investigating'],
      Compliance_Officer: ['New', 'Under_Review', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Investigating: {
      Investigator: ['Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'],
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Pending_Evidence: {
      Investigator: ['Investigating', 'Substantiated', 'Dismissed_No_Evidence'],
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
  };

  // EAAC can also transition out of terminal statuses (reopen/override a closed case)
  if (isTerminalStatus(currentStatus)) {
    if (role === 'Compliance_Officer') {
      return COMPLIANCE_OFFICER_STATUSES.filter(s => s !== currentStatus);
    }
    return [];
  }
  return transitions[currentStatus]?.[role] || [];
};

export const formatStatus = (status) =>
  STATUS_LABELS[status] || status?.replace(/_/g, ' ') || status;
