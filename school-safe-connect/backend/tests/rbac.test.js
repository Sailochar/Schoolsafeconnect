/**
 * Unit Tests for Role-Based Access Control (RBAC) & Platform Client Separation
 */

const { authorizeRoles, enforceWebClientOnly, enforceMobileClientOnly } = require('../src/middlewares/rbacGuard');
const { ROLES } = require('../src/config/constants');

describe('RBAC Middleware & Client Platform Separation', () => {
  let req, res, next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should allow access when user role matches authorized roles', () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-ADM-001',
        role: ROLES.SCHOOL_ADMIN
      }
    };

    const guard = authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.GLOBAL_SUPER_ADMIN);
    guard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should reject access with 403 when user lacks authorized role', () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-PAR-015',
        role: ROLES.PARENT
      }
    };

    const guard = authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.GLOBAL_SUPER_ADMIN);
    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Access denied. Role [PARENT] is not authorized')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('enforceWebClientOnly should allow Web users (Super Admin, School Admin, Transport Coordinator)', () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-ADM-001',
        role: ROLES.SCHOOL_ADMIN
      }
    };

    enforceWebClientOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('enforceWebClientOnly should BLOCK Mobile users (Parent, Teacher, Driver)', () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-PAR-015',
        role: ROLES.PARENT
      }
    };

    enforceWebClientOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Mobile users (Parents, Teachers, Drivers) must not access administrative web dashboards')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('enforceMobileClientOnly should allow Mobile users (Parent, Teacher, Driver)', () => {
    req = {
      user: {
        userCode: 'SSC-SCH-1023-DRV-003',
        role: ROLES.DRIVER
      }
    };

    enforceMobileClientOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('enforceMobileClientOnly should BLOCK Web administrative users', () => {
    req = {
      user: {
        userCode: 'SSC-GSA-001',
        role: ROLES.GLOBAL_SUPER_ADMIN
      }
    };

    enforceMobileClientOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('Web administrative users must not use the mobile application')
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
