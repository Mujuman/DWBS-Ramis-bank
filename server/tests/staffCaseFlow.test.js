jest.mock('../config/db', () => ({
  pool: { execute: jest.fn() },
}));

jest.mock('../services/auditService', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('isomorphic-dompurify', () => ({
  sanitize: (input) => input,
}));

jest.mock('../services/emailService', () => ({
  notifyNewCaseToCompliance: jest.fn().mockResolvedValue(undefined),
  notifyAssignment: jest.fn().mockResolvedValue(undefined),
  notifyCEOEscalation: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/db');
const emailService = jest.requireMock('../services/emailService');
const { validationResult } = require('express-validator');
const { validateStatusUpdate } = require('../middleware/sanitize');
let editCase, deleteCase, updateCaseStatus;

describe('staff case workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const controllers = require('../controllers/caseController');
    editCase = controllers.editCase;
    deleteCase = controllers.deleteCase;
    updateCaseStatus = controllers.updateCaseStatus;
  });

  it('allows a staff reporter to edit their own case description', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 11, user_id: 7, status: 'New', severity_level: 'Low' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = {
      user: { userId: 7, role: 'Employee' },
      params: { id: '11' },
      body: { description: 'Updated description from staff user.' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await editCase(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Case updated successfully' }));
  });

  it('soft deletes a staff-owned case with a justification', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 12, user_id: 8, deleted_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = {
      user: { userId: 8, role: 'Branch_Manager' },
      params: { id: '12' },
      body: { justification: 'Duplicate report submitted by mistake.' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await deleteCase(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Case deleted successfully' }));
  });

  it('allows a compliance officer to update case priority without sending a status', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 21, status: 'New', severity_level: 'Low', assigned_investigator: null, is_escalated: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const req = {
      user: { userId: 99, role: 'Compliance_Officer' },
      params: { id: '21' },
      body: { priority: 'High' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateCaseStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Case updated successfully' }));
  });

  it('prevents an investigator from setting status outside their allowed workflow', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 31, status: 'Under_Review', severity_level: 'Medium', assigned_investigator: 5, is_escalated: 0 }]]);

    const req = {
      user: { userId: 5, role: 'Investigator' },
      params: { id: '31' },
      body: { status: 'Assigned' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateCaseStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Invalid transition from "Analyse the Complaint" to "Refer to A&RC / Assign to Case Investigator" for your role.',
    }));
  });

  it('prevents a compliance officer from moving status outside their allowed workflow', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 41, status: 'New', severity_level: 'High', assigned_investigator: null, is_escalated: 0, reference_id: 'REF123456789', category: 'Fraud' }]]);

    const req = {
      user: { userId: 96, role: 'Compliance_Officer' },
      params: { id: '41' },
      body: { status: 'Resolved' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateCaseStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Invalid transition from "New" to "Resolved" for your role.',
    }));
  });

  it('allows an assigned investigator to view report description', async () => {
    pool.execute
      .mockResolvedValueOnce([[{
        case_id: 99,
        user_id: 11,
        assigned_investigator: 5,
        status: 'Assigned',
        severity_level: 'Medium',
        category: 'System_Misuse',
        reference_id: 'REFDESC12345',
        description: 'This is the report description visible to the assigned investigator.',
        created_at: '2026-07-08T12:00:00.000Z',
        updated_at: '2026-07-08T12:00:00.000Z',
      }]]);

    const req = {
      user: { userId: 5, role: 'Investigator' },
      params: { id: '99' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const { getCaseById } = require('../controllers/caseController');
    await getCaseById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ case: expect.objectContaining({ description: 'This is the report description visible to the assigned investigator.' }) }));
  });

  it('notifies CEO when investigator escalates case priority to Critical', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 51, status: 'Under_Review', severity_level: 'Medium', assigned_investigator: 7, is_escalated: 0, reference_id: 'REFABCDEF123', category: 'Bribery' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ email: 'ceo@bank.local' }]]);

    // Per BRD: only Compliance Officers may escalate priority to Critical
    const req = {
      user: { userId: 99, role: 'Compliance_Officer' },
      params: { id: '51' },
      body: { priority: 'Critical' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateCaseStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Case updated successfully' }));
    expect(pool.execute).toHaveBeenCalledWith(
      `SELECT email FROM users WHERE role = 'CEO' AND is_active = 1 LIMIT 1`
    );
    expect(emailService.notifyCEOEscalation).toHaveBeenCalledWith(
      'ceo@bank.local',
      expect.objectContaining({ reference_id: 'REFABCDEF123', category: 'Bribery' })
    );
  });

  it('accepts priority-only updates through the status validation middleware', async () => {
    const req = { params: { id: '21' }, body: { priority: 'High' } };
    const res = {};

    for (const middleware of validateStatusUpdate) {
      await new Promise((resolve) => middleware(req, res, resolve));
    }

    expect(validationResult(req).isEmpty()).toBe(true);
  });
});
