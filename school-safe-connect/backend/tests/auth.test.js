/**
 * Unit Tests for Two-Factor Authentication Service & Platform Boundary
 */

const AuthService = require('../src/services/auth.service');
const { User, SuperAdmin } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { hashOtp } = require('../src/utils/otp');
const NotificationSenderService = require('../src/services/notificationSender.service');
const AuditService = require('../src/services/audit.service');
const { ROLES, USER_STATUS, CLIENT_TYPES } = require('../src/config/constants');

jest.mock('../src/services/notificationSender.service', () => ({
  sendOtp: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue({})
}));
jest.mock('../src/models', () => {
  const original = jest.requireActual('../src/models');
  return {
    ...original,
    User: {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }),
      findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null), exec: jest.fn().mockResolvedValue(null) })
    },
    SuperAdmin: {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }),
      findById: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null), exec: jest.fn().mockResolvedValue(null) })
    },
    Device: {
      findOneAndUpdate: jest.fn().mockResolvedValue({})
    }
  };
});

describe('AuthService (Mandatory 2FA Flow & Platform Separation)', () => {
  let mockUser;
  let rawPassword = 'Password123!';

  beforeEach(async () => {
    jest.clearAllMocks();
    const passwordHash = await hashPassword(rawPassword);

    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      schoolCode: 'SSC-SCH-1023',
      userCode: 'SSC-SCH-1023-PAR-015',
      role: ROLES.PARENT,
      fullName: 'Ravi Kumar',
      email: 'ravi.kumar@example.com',
      phone: '+919876543210',
      passwordHash,
      status: USER_STATUS.ACTIVE,
      failedLoginAttempts: 0,
      twoFactor: {
        method: 'SMS',
        otpAttempts: 0
      },
      save: jest.fn().mockResolvedValue(true)
    };
  });

  test('Step 1: Should verify password, generate OTP, and return 2FA challenge for Mobile user', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const result = await AuthService.loginStep1({
      identifier: 'ravi.kumar@example.com',
      password: rawPassword,
      clientType: CLIENT_TYPES.MOBILE,
      ipAddress: '127.0.0.1',
      userAgent: 'FlutterMobileApp'
    });

    expect(result.requires2FA).toBe(true);
    expect(result.tempToken).toBeDefined();
    expect(result.maskedPhone).toBe('*********3210');
    expect(mockUser.twoFactor.otpCodeHash).toBeDefined();
    expect(mockUser.twoFactor.otpExpiresAt).toBeDefined();
    expect(NotificationSenderService.sendOtp).toHaveBeenCalled();
  });

  test('Step 1: Should BLOCK mobile user (Parent) attempting to log into WEB client', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    await expect(
      AuthService.loginStep1({
        identifier: 'ravi.kumar@example.com',
        password: rawPassword,
        clientType: CLIENT_TYPES.WEB, // Unauthorized client for mobile role
        ipAddress: '127.0.0.1',
        userAgent: 'BrowserDashboard'
      })
    ).rejects.toThrow('Mobile users (Parents, Teachers, Drivers) must not access the administrative web application.');
  });

  test('Step 1: Should reject with 401 when password does not match', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    await expect(
      AuthService.loginStep1({
        identifier: 'ravi.kumar@example.com',
        password: 'WrongPassword!',
        clientType: CLIENT_TYPES.MOBILE,
        ipAddress: '127.0.0.1',
        userAgent: 'FlutterMobileApp'
      })
    ).rejects.toThrow('Invalid credentials');

    expect(mockUser.failedLoginAttempts).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
  });

  test('Step 2: Should verify 6-digit OTP and return JWT access and refresh tokens', async () => {
    const rawOtp = '582914';
    mockUser.twoFactor.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    mockUser.twoFactor.otpAttempts = 0;

    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const step1Result = await AuthService.loginStep1({
      identifier: 'ravi.kumar@example.com',
      password: rawPassword,
      clientType: CLIENT_TYPES.MOBILE,
      ipAddress: '127.0.0.1',
      userAgent: 'FlutterMobileApp'
    });
    mockUser.twoFactor.otpCodeHash = hashOtp(rawOtp);

    const step2Result = await AuthService.verify2FA({
      tempToken: step1Result.tempToken,
      otp: rawOtp,
      deviceDetails: { deviceId: 'test-device-uuid' },
      ipAddress: '127.0.0.1',
      userAgent: 'FlutterMobileApp'
    });

    expect(step2Result.accessToken).toBeDefined();
    expect(step2Result.refreshToken).toBeDefined();
    expect(step2Result.user.userCode).toBe('SSC-SCH-1023-PAR-015');
    expect(step2Result.user.platformClient).toBe(CLIENT_TYPES.MOBILE);
    expect(mockUser.twoFactor.otpCodeHash).toBeUndefined();
  });

  test('Step 2: Should reject invalid OTP and increment attempt counter', async () => {
    const rawOtp = '582914';
    mockUser.twoFactor.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    mockUser.twoFactor.otpAttempts = 0;

    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const step1Result = await AuthService.loginStep1({
      identifier: 'ravi.kumar@example.com',
      password: rawPassword,
      clientType: CLIENT_TYPES.MOBILE,
      ipAddress: '127.0.0.1',
      userAgent: 'FlutterMobileApp'
    });
    mockUser.twoFactor.otpCodeHash = hashOtp(rawOtp);

    await expect(
      AuthService.verify2FA({
        tempToken: step1Result.tempToken,
        otp: '000000',
        deviceDetails: {},
        ipAddress: '127.0.0.1',
        userAgent: 'FlutterMobileApp'
      })
    ).rejects.toThrow('Invalid OTP');

    expect(mockUser.twoFactor.otpAttempts).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
  });
});
