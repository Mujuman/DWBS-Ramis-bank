jest.mock('../config/db', () => ({
  pool: { execute: jest.fn() },
}));

jest.mock('../services/auditService', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/emailService', () => ({
  notifyNewCaseToCompliance: jest.fn().mockResolvedValue(undefined),
  notifyAssignment: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/db');
const { validationResult } = require('express-validator');
const { editCase, deleteCase, updateCaseStatus } = require('../controllers/caseController');
const { validateStatusUpdate } = require('../middleware/sanitize');

describe('staff case workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      .mockResolvedValueOnce([[{ case_id: 31, status: 'New', severity_level: 'Medium', assigned_investigator: 5, is_escalated: 0 }]]);

    const req = {
      user: { userId: 5, role: 'Investigator' },
      params: { id: '31' },
      body: { status: 'New' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await updateCaseStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Investigators may only update status within their allowed workflow.' }));
  });

  it('prevents a compliance officer from moving status outside their allowed workflow', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ case_id: 41, status: 'New', severity_level: 'High', assigned_investigator: null, is_escalated: 0 }]]);

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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Compliance Officers may only update status during assignment and review stages.' }));
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
