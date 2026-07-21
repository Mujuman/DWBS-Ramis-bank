const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

/**
 * Extracts validation errors from express-validator.
 * Returns 422 with detailed error list if any validation failed.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

/**
 * Recursively strips XSS payloads from all string values in an object.
 * Applied as middleware after express.json() parser.
 */
const sanitizeRequestBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
};

const deepSanitize = (obj) => {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }
  if (obj !== null && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = deepSanitize(v);
    }
    return clean;
  }
  return obj;
};

// ── Validation Chain Definitions ─────────────────────────────

const validateAnonSession = [
  body('captcha_token')
    .notEmpty().withMessage('CAPTCHA token is required')
    .isString()
    .trim(),
];

const validateLogin = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Invalid username format')
    .trim(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1, max: 256 }),
];

const validateCreateUser = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Invalid username format')
    .trim(),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .trim(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['Employee', 'Branch_Manager', 'Investigator', 'Compliance_Officer', 'CEO', 'System_Admin', 'Auditor'])
    .withMessage('Invalid role'),
  body('department')
    .notEmpty().withMessage('Department is required')
    .isLength({ min: 2, max: 100 }).withMessage('Department must be 2-100 characters')
    .trim(),
];

const validateResetPassword = [
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const validateCreateCase = [
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['Fraud', 'Corruption', 'Bribery', 'Abuse_of_Power', 'Procurement_Violation', 'System_Misuse'])
    .withMessage('Invalid category'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 20, max: 10000 }).withMessage('Description must be 20–10,000 characters'),
  body('branch_or_dept')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Branch or department must be 2–100 characters'),
  body('severity_level')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid severity level'),
  body('incident_date')
    .optional()
    .isDate().withMessage('Invalid incident date format'),
  body('incident_location')
    .optional()
    .isLength({ max: 100 }).withMessage('Location too long (max 100 characters)'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid priority'),
];

const validateEditCaseAnonymous = [
  body('reference_id')
    .notEmpty().withMessage('Reference ID is required')
    .matches(/^[A-Z2-9]{12}$/i).withMessage('Invalid reference ID format')
    .trim(),
  body('verification_token')
    .notEmpty().withMessage('Verification token is required')
    .isString()
    .trim(),
  body('category')
    .optional()
    .isIn(['Fraud', 'Corruption', 'Bribery', 'Abuse_of_Power', 'Procurement_Violation', 'System_Misuse'])
    .withMessage('Invalid category'),
  body('description')
    .optional()
    .isLength({ min: 20, max: 10000 }).withMessage('Description must be 20–10,000 characters'),
];

const validateAnonEditBranch = body('branch_or_dept')
  .optional()
  .isLength({ min: 2, max: 100 }).withMessage('Branch or department must be 2-100 characters');

validateEditCaseAnonymous.push(validateAnonEditBranch);

const validateCreateAnonNote = [
  body('reference_id')
    .notEmpty().withMessage('Reference ID is required')
    .matches(/^[A-Z2-9]{12}$/i).withMessage('Invalid reference ID format')
    .trim(),
  body('verification_token')
    .notEmpty().withMessage('Verification token is required')
    .isString()
    .trim(),
  body('body')
    .notEmpty().withMessage('Response body is required')
    .isLength({ min: 5, max: 5000 }).withMessage('Response body must be 5–5000 characters'),
];

const validateAnonNoteRecipient = body('recipient_role')
  .optional()
  .isIn(['Investigator', 'Compliance_Officer']).withMessage('Invalid response recipient');

validateCreateAnonNote.splice(validateCreateAnonNote.length - 1, 0, validateAnonNoteRecipient);

const validateDeleteCaseAnonymous = [
  body('reference_id')
    .notEmpty().withMessage('Reference ID is required')
    .matches(/^[A-Z2-9]{12}$/i).withMessage('Invalid reference ID format')
    .trim(),
  body('verification_token')
    .notEmpty().withMessage('Verification token is required')
    .isString()
    .trim(),
];

const { CASE_STATUSES } = require('../constants/caseWorkflow');

const validateStatusUpdate = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid case ID'),
  body('status')
    .optional()
    .isIn(CASE_STATUSES)
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid priority'),
  body('assigned_to')
    .optional()
    .isInt({ min: 1 }).withMessage('Invalid assignee ID'),
];

const validateCreateNote = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid case ID'),
  body('body')
    .notEmpty().withMessage('Note body is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Note body too long'),
  body('is_internal_only')
    .optional()
    .isBoolean().withMessage('is_internal_only must be boolean'),
  body('recipient_role')
    .optional()
    .isIn(['Investigator', 'Compliance_Officer']).withMessage('Invalid note recipient'),
];

const validateTrackCase = [
  query('reference_id')
    .notEmpty().withMessage('Reference ID is required')
    .matches(/^[A-Z2-9]{12}$/i).withMessage('Invalid reference ID format')
    .trim(),
];

module.exports = {
  handleValidationErrors,
  sanitizeRequestBody,
  validateAnonSession,
  validateLogin,
  validateCreateUser,
  validateResetPassword,
  validateCreateCase,
  validateEditCaseAnonymous,
  validateDeleteCaseAnonymous,
  validateStatusUpdate,
  validateCreateNote,
  validateCreateAnonNote,
  validateTrackCase,
};
