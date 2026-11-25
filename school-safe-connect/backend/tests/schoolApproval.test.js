/**
 * Unit Tests for School Approval Engine
 */

const SchoolApprovalService = require('../src/services/schoolApproval.service');
const IdGeneratorService = require('../src/services/idGenerator.service');
const AuditService = require('../src/services/audit.service');
const { OnboardingRequest, School, User, AcademicYear } = require('../src/models');
const { SCHOOL_STATUS, ROLES } = require('../src/config/constants');

jest.mock('../src/services/idGenerator.service');
jest.mock('../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue({})
}));
jest.mock('../src/models', () => {
  const original = jest.requireActual('../src/models');
  return {
    ...original,
    OnboardingRequest: {
      findOne: jest.fn()
    },
    School: jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data)
    })),
    User: jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data)
    })),
    AcademicYear: jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data)
    }))
  };
});

describe('SchoolApprovalService', () => {
  const mockSuperAdmin = {
    userCode: 'SSC-GSA-001',
    role: ROLES.GLOBAL_SUPER_ADMIN,
    fullName: 'Global Security Director',
    email: 'superadmin@schoolsafeconnect.internal'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reject approval when mandatory reason is too short (< 10 chars)', async () => {
    await expect(
      SchoolApprovalService.approveSchoolRequest({
        requestId: 'REQ-12345',
        reason: 'Too short',
        superAdmin: mockSuperAdmin,
        ipAddress: '127.0.0.1',
        userAgent: 'Jest'
      })
    ).rejects.toThrow('A mandatory approval reason (minimum 10 characters) is required.');
  });

  test('should successfully approve school, allocate identity codes, and provision tenant', async () => {
    const mockRequest = {
      requestId: 'REQ-12345',
      schoolName: 'Example Public School',
      board: 'CBSE',
      address: { street: '123 Pilot Way', city: 'Delhi', state: 'Delhi', postalCode: '110001' },
      contactPerson: { name: 'Dr. Sharma', phone: '+919876543210', email: 'sharma@example.edu' },
      proposedAdminDetails: { fullName: 'Rajesh Sharma', email: 'admin@example.edu', phone: '+919876543211' },
      status: SCHOOL_STATUS.PENDING,
      save: jest.fn().mockResolvedValue(true)
    };

    OnboardingRequest.findOne.mockResolvedValue(mockRequest);
    IdGeneratorService.generateSchoolCode.mockResolvedValue('SSC-SCH-1023');
    IdGeneratorService.generateUserCode.mockResolvedValue('SSC-SCH-1023-ADM-001');

    const result = await SchoolApprovalService.approveSchoolRequest({
      requestId: 'REQ-12345',
      reason: 'Verified official CBSE accreditation documents and governing body resolution.',
      superAdmin: mockSuperAdmin,
      ipAddress: '127.0.0.1',
      userAgent: 'Jest'
    });

    expect(result.school.schoolCode).toBe('SSC-SCH-1023');
    expect(result.adminUser.userCode).toBe('SSC-SCH-1023-ADM-001');
    expect(mockRequest.status).toBe(SCHOOL_STATUS.APPROVED);
    expect(mockRequest.allocatedSchoolCode).toBe('SSC-SCH-1023');
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SCHOOL_APPROVED',
        schoolCode: 'SSC-SCH-1023',
        resourceId: 'SSC-SCH-1023'
      })
    );
  });
});
