jest.mock('../config/db', () => ({
  auditPool: {
    execute: jest.fn().mockResolvedValue([{}]),
  },
}));

const { writeAuditLog } = require('../services/auditService');
const { auditPool } = require('../config/db');

describe('auditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not write audit logs when performedByRole is not CEO', async () => {
    await writeAuditLog({
      userId: 1,
      action: 'TEST_ACTION',
      caseId: 123,
      metadata: { foo: 'bar' },
      performedByRole: 'Investigator',
    });

    expect(auditPool.execute).not.toHaveBeenCalled();
  });

  it('does not write audit logs when performedByRole is missing', async () => {
    await writeAuditLog({
      userId: 1,
      action: 'TEST_ACTION',
      caseId: 123,
      metadata: { foo: 'bar' },
    });

    expect(auditPool.execute).not.toHaveBeenCalled();
  });

  it('writes audit logs only when performedByRole is CEO', async () => {
    await writeAuditLog({
      userId: 2,
      action: 'CEO_ACTION',
      caseId: 456,
      metadata: { reason: 'executive review' },
      performedByRole: 'CEO',
    });

    expect(auditPool.execute).toHaveBeenCalledTimes(1);
    expect(auditPool.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO auditlogs'),
      expect.any(Array)
    );
  });
});
