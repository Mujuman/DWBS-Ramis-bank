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
const { editCase, deleteCase } = require('../controllers/caseController');

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
});
