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

const validateCreateCase = [
  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn(['Fraud', 'Bribery', 'Corruption', 'Harassment', 'AML_Violation', 'Data_Breach', 'Policy_Violation', 'Other'])
    .withMessage('Invalid category'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 20, max: 10000 }).withMessage('Description must be 20–10,000 characters'),
  body('incident_date')
    .optional()
    .isDate().withMessage('Invalid incident date format'),
  body('incident_location')
    .optional()
    .isLength({ max: 500 }).withMessage('Location too long'),
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid priority'),
];

const validateStatusUpdate = [
  param('id')
    .isInt({ min: 1 }).withMessage('Invalid case ID'),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['New', 'Under_Review', 'Investigation_In_Progress', 'Awaiting_Response', 'Resolved', 'Closed', 'Escalated'])
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
];

const validateTrackCase = [
  query('reference_id')
    .notEmpty().withMessage('Reference ID is required')
    .matches(/^[A-Z2-9]{12}$/).withMessage('Invalid reference ID format')
    .trim(),
];

module.exports = {
  handleValidationErrors,
  sanitizeRequestBody,
  validateAnonSession,
  validateLogin,
  validateCreateCase,
  validateStatusUpdate,
  validateCreateNote,
  validateTrackCase,
};
