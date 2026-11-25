/**
 * Unit Tests for Multi-Tenant Isolation Middleware (tenantGuard)
 */

const tenantGuard = require('../src/middlewares/tenantGuard');
const { ROLES } = require('../src/config/constants');
const AuditService = require('../src/services/audit.service');

jest.mock('../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue({})
}));

describe('Multi-Tenant Isolation Middleware (tenantGuard)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should reject request when unauthenticated (req.user missing)', async () => {
    req = { headers: {} };

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Unauthorized')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('should bind req.tenantSchoolCode for authorized School A user', async () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-PAR-015',
        schoolCode: 'SSC-SCH-1023',
        role: ROLES.PARENT
      },
      params: {},
      query: {},
      body: {},
      headers: {}
    };

    await tenantGuard(req, res, next);

    expect(req.tenantSchoolCode).toBe('SSC-SCH-1023');
    expect(next).toHaveBeenCalled();
  });

  test('should BLOCK cross-tenant access when School A user supplies School B in params', async () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-PAR-015',
        schoolCode: 'SSC-SCH-1023',
        role: ROLES.PARENT
      },
      params: { schoolCode: 'SSC-SCH-2045' }, // Foreign school
      query: {},
      body: {},
      headers: {},
      originalUrl: '/api/v1/classes/SSC-SCH-2045-CLS-6A'
    };

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('CROSS-TENANT ACCESS FORBIDDEN')
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CROSS_TENANT_ACCESS_ATTEMPT_BLOCKED'
      })
    );
  });

  test('should BLOCK cross-tenant access when School A user supplies School B in request body', async () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-ADM-001',
        schoolCode: 'SSC-SCH-1023',
        role: ROLES.SCHOOL_ADMIN
      },
      params: {},
      query: {},
      body: { schoolCode: 'SSC-SCH-2045' }, // Injected cross-tenant payload
      headers: {},
      originalUrl: '/api/v1/students'
    };

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('should require mandatory reason when Super Admin inspects a specific tenant', async () => {
    req = {
      user: {
        userCode: 'SSC-GSA-001',
        role: ROLES.GLOBAL_SUPER_ADMIN,
        fullName: 'Global Security Director',
        email: 'superadmin@schoolsafeconnect.internal'
      },
      headers: {
        'x-school-code': 'SSC-SCH-1023'
        // Missing x-super-admin-reason
      },
      params: {},
      query: {},
      body: {}
    };

    await tenantGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('mandatory justification reason')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('should allow Super Admin tenant inspection when valid reason is provided and audit log it', async () => {
    req = {
      user: {
        userCode: 'SSC-GSA-001',
        role: ROLES.GLOBAL_SUPER_ADMIN,
        fullName: 'Global Security Director',
        email: 'superadmin@schoolsafeconnect.internal'
      },
      headers: {
        'x-school-code': 'SSC-SCH-1023',
        'x-super-admin-reason': 'Investigating safety incident alert INC-004'
      },
      params: {},
      query: {},
      body: {},
      originalUrl: '/api/v1/incidents'
    };

    await tenantGuard(req, res, next);

    expect(req.tenantSchoolCode).toBe('SSC-SCH-1023');
    expect(next).toHaveBeenCalled();
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SUPER_ADMIN_TENANT_INSPECTION',
        schoolCode: 'SSC-SCH-1023',
        reason: 'Investigating safety incident alert INC-004'
      })
    );
  });
});
