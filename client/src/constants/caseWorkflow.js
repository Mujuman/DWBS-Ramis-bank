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
  'Assigned',
  'Investigating',
  'Pending_Evidence',
  'Substantiated',
  'Dismissed_No_Evidence',
  'Complaint_Dismissed',
];

// CEO can only assign handler on escalated cases (Critical) reported by Ethics Office
export const CEO_STATUSES = ['Assigned'];

export const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Complaint_Dismissed: 'Complaint Dismissed',
  Assigned: 'Refer to A&RC / Assign Case Handler',
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
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Under_Review: {
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Assigned: {
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Investigating: {
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
      CEO: ['Assigned'],
    },
    Pending_Evidence: {
      Compliance_Officer: ['New', 'Under_Review', 'Assigned', 'Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence', 'Complaint_Dismissed'],
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
  
  const availableStatuses = transitions[currentStatus]?.[role] || [];
  
  // Always include the current status if not already in the list
  if (availableStatuses.length > 0 && !availableStatuses.includes(currentStatus)) {
    return [currentStatus, ...availableStatuses];
  }
  
  return availableStatuses;
};

export const formatStatus = (status) =>
  STATUS_LABELS[status] || status?.replace(/_/g, ' ') || status;
