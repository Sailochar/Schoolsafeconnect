/**
 * Unit Tests for Section 8 Hierarchical Identity Code Generation
 */

const IdGeneratorService = require('../src/services/idGenerator.service');
const { Counter } = require('../src/models');
const { ROLES } = require('../src/config/constants');

jest.mock('../src/models', () => {
  const original = jest.requireActual('../src/models');
  return {
    ...original,
    Counter: {
      findOneAndUpdate: jest.fn()
    }
  };
});

describe('IdGeneratorService (Section 8 Compliance)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate properly formatted School Code SSC-SCH-1023', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 1023 });

    const code = await IdGeneratorService.generateSchoolCode();
    expect(code).toBe('SSC-SCH-1023');
  });

  test('should generate Super Admin Code SSC-GSA-001', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 1 });

    const code = await IdGeneratorService.generateSuperAdminCode();
    expect(code).toBe('SSC-GSA-001');
  });

  test('should generate properly formatted School Admin Code SSC-SCH-1023-ADM-001', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 1 });

    const code = await IdGeneratorService.generateUserCode('SSC-SCH-1023', ROLES.SCHOOL_ADMIN);
    expect(code).toBe('SSC-SCH-1023-ADM-001');
  });

  test('should generate properly formatted Teacher Code SSC-SCH-1023-TCH-001', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 1 });

    const code = await IdGeneratorService.generateUserCode('SSC-SCH-1023', ROLES.CLASS_TEACHER);
    expect(code).toBe('SSC-SCH-1023-TCH-001');
  });

  test('should generate properly formatted Parent Code SSC-SCH-1023-PAR-015', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 15 });

    const code = await IdGeneratorService.generateUserCode('SSC-SCH-1023', ROLES.PARENT);
    expect(code).toBe('SSC-SCH-1023-PAR-015');
  });

  test('should generate properly formatted Driver Code SSC-SCH-1023-DRV-003', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 3 });

    const code = await IdGeneratorService.generateUserCode('SSC-SCH-1023', ROLES.DRIVER);
    expect(code).toBe('SSC-SCH-1023-DRV-003');
  });

  test('should generate properly formatted Student Code SSC-SCH-1023-STU-102', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 102 });

    const code = await IdGeneratorService.generateStudentCode('SSC-SCH-1023');
    expect(code).toBe('SSC-SCH-1023-STU-102');
  });

  test('should format Class Code SSC-SCH-1023-CLS-6A', () => {
    const code = IdGeneratorService.formatClassCode('SSC-SCH-1023', '6', 'A');
    expect(code).toBe('SSC-SCH-1023-CLS-6A');
  });

  test('should generate Bus Code SSC-SCH-1023-BUS-012', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 12 });

    const code = await IdGeneratorService.generateBusCode('SSC-SCH-1023');
    expect(code).toBe('SSC-SCH-1023-BUS-012');
  });

  test('should generate Camera Code SSC-SCH-1023-CAM-004', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ sequenceValue: 4 });

    const code = await IdGeneratorService.generateCameraCode('SSC-SCH-1023');
    expect(code).toBe('SSC-SCH-1023-CAM-004');
  });
});
