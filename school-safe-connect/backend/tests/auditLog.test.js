/**
 * Unit Tests for Audit Log Ledger Immutability
 */

const { AuditLog } = require('../src/models');

describe('AuditLog Immutability Constraints', () => {
  test('should throw security violation error when attempting updateOne on AuditLog', async () => {
    let thrownError = null;
    try {
      await AuditLog.updateOne({ logId: 'AUD-TEST' }, { action: 'MODIFIED_ACTION' });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain('SECURITY VIOLATION: Audit logs are immutable');
  });

  test('should throw security violation error when attempting deleteOne on AuditLog', async () => {
    let thrownError = null;
    try {
      await AuditLog.deleteOne({ logId: 'AUD-TEST' });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain('SECURITY VIOLATION: Audit logs are immutable');
  });

  test('should throw security violation error when attempting findOneAndDelete on AuditLog', async () => {
    let thrownError = null;
    try {
      await AuditLog.findOneAndDelete({ logId: 'AUD-TEST' });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain('SECURITY VIOLATION: Audit logs are immutable');
  });
});
