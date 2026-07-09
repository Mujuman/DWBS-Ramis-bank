/**
 * Compliance-aligned case workflow — mirrors server/constants/caseWorkflow.js
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

export const COMPLIANCE_OFFICER_STATUSES = ['Under_Review', 'Complaint_Dismissed', 'Assigned'];

export const INVESTIGATOR_STATUSES = ['Investigating', 'Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'];

export const STATUS_LABELS = {
  New: 'New',
  Under_Review: 'Analyse the Complaint',
  Complaint_Dismissed: 'Complaint Dismissed',
  Assigned: 'Referred to A&RC / Assigned',
  Investigating: 'Active Investigation',
  Pending_Evidence: 'Pending Evidence',
  Substantiated: 'Substantiated (በማስረጃ የተረጋገጠ)',
  Dismissed_No_Evidence: 'Dismissed — Lack of Evidence',
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
    New: { Compliance_Officer: ['Under_Review'] },
    Under_Review: { Compliance_Officer: ['Complaint_Dismissed', 'Assigned'] },
    Assigned: { Investigator: ['Investigating'] },
    Investigating: { Investigator: ['Pending_Evidence', 'Substantiated', 'Dismissed_No_Evidence'] },
    Pending_Evidence: { Investigator: ['Investigating', 'Substantiated', 'Dismissed_No_Evidence'] },
  };
  if (isTerminalStatus(currentStatus)) return [];
  return transitions[currentStatus]?.[role] || [];
};

export const formatStatus = (status) =>
  STATUS_LABELS[status] || status?.replace(/_/g, ' ') || status;
