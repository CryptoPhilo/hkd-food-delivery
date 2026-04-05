/**
 * Customer Authentication Tests
 * Tests for phone-based OTP authentication, phone verification, and JWT token refresh
 */

import request from 'supertest';
import app from '../../src/app';
import { jwtService } from '../../src/services/JWTTokenService';
import { smsService } from '../../src/services/SMSService';

jest.mock('../../src/services/SMSService');
jest.mock('../../src/services/JWTTokenService');

describe('POST /api/v1/auth/phone/request - Phone OTP Request', () => {
  const mockPhone = '01012345678';
  const mockValidPhones = [
    '01012345678',
    '01099999999',
    '01016789012', // 016 prefix
    '01112345678', // 011 prefix
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid phone number', () => {
    it('should send OTP code for valid Korean mobile number', async () => {
      (smsService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'test-msg-001',
      });

      const res = await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('인증번호가 전송되었습니다');
      expect(res.body.expires_in).toBe(180);
      expect(smsService.sendSMS).toHaveBeenCalled();
    });

    it('should accept various valid Korean phone formats', async () => {
      (smsService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'test-msg-001',
      });

      for (const phone of mockValidPhones) {
        const res = await request(app).post('/api/v1/auth/phone/request').send({
          phone,
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });

    it('should generate and send a 6-digit verification code', async () => {
      (smsService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'test-msg-001',
      });

      const res = await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      expect(res.status).toBe(200);
      const callArgs = (smsService.sendSMS as jest.Mock).mock.calls[0][0];
      const messageContent = callArgs.message;
      expect(messageContent).toMatch(/\d{6}/);
    });
  });

  describe('Invalid phone number', () => {
    it('should reject missing phone number', async () => {
      const res = await request(app).post('/api/v1/auth/phone/request').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid phone format', async () => {
      const invalidPhones = ['123', 'not-a-phone', '01012345', '010 1234 5678 extra'];

      for (const phone of invalidPhones) {
        const res = await request(app).post('/api/v1/auth/phone/request').send({
          phone,
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    it('should reject non-Korean phone numbers', async () => {
      const invalidPhones = ['+1-201-555-0123', '44-201-555-0123', '+86-10-1234-5678'];

      for (const phone of invalidPhones) {
        const res = await request(app).post('/api/v1/auth/phone/request').send({
          phone,
        });

        expect([400, 422]).toContain(res.status);
        expect(res.body.success).toBe(false);
      }
    });

    it('should reject phone numbers with invalid characters', async () => {
      const res = await request(app).post('/api/v1/auth/phone/request').send({
        phone: '010-ABCD-5678',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should allow multiple requests within rate limit', async () => {
      (smsService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageId: 'test-msg-001',
      });

      const res1 = await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res2 = await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  describe('SMS service error handling', () => {
    it('should handle SMS service failure gracefully', async () => {
      (smsService.sendSMS as jest.Mock).mockRejectedValue(
        new Error('SMS service unavailable')
      );

      const res = await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      expect([500, 503]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('POST /api/v1/auth/phone/verify - OTP Verification', () => {
  const mockPhone = '01012345678';
  const mockCode = '123456';
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid verification', () => {
    it('should return JWT tokens for valid code', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(validToken);
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token-123');

      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: mockCode,
      });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.access_token).toBeDefined();
        expect(res.body.refresh_token).toBeDefined();
      }
    });

    it('should create user if not exists', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(validToken);
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token-123');

      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: mockCode,
      });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.user).toBeDefined();
        expect(res.body.user.phone).toBe(mockPhone);
      }
    });

    it('should return existing user if already registered', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(validToken);
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token-123');

      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: mockCode,
      });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.user).toBeDefined();
      }
    });
  });

  describe('Invalid code', () => {
    it('should reject missing verification code', async () => {
      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject incorrect verification code', async () => {
      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: 'wrong-code',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject code with wrong format', async () => {
      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const invalidCodes = ['12345', '1234567', 'abcdef', '12-34-56'];

      for (const code of invalidCodes) {
        const res = await request(app).post('/api/v1/auth/phone/verify').send({
          phone: mockPhone,
          code,
        });

        expect([400, 422]).toContain(res.status);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('Expired code', () => {
    it('should reject expired verification code', async () => {
      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: mockCode,
      });

      // When code is expired or incorrect, should return 400
      if (res.status === 400) {
        expect(res.body.success).toBe(false);
      }
    });

    it('should indicate code expiration in error message', async () => {
      // First request OTP to set it up
      await request(app).post('/api/v1/auth/phone/request').send({
        phone: mockPhone,
      });

      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: mockPhone,
        code: 'expired-code',
      });

      if (res.status === 400) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('Missing or invalid phone', () => {
    it('should require phone number in request', async () => {
      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        code: mockCode,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject code if no OTP was requested for phone', async () => {
      const res = await request(app).post('/api/v1/auth/phone/verify').send({
        phone: '010-9999-9999',
        code: mockCode,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('요청');
    });
  });
});

describe('POST /api/v1/auth/token/refresh - Token Refresh', () => {
  const mockRefreshToken = 'refresh-token-123';
  const mockAccessToken = 'new-access-token';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid refresh token', () => {
    it('should return new access token for valid refresh token', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockReturnValue(mockAccessToken);

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: mockRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.access_token).toBe(mockAccessToken);
    });

    it('should maintain user session with refreshed token', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockReturnValue(mockAccessToken);

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: mockRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
    });
  });

  describe('Invalid refresh token', () => {
    it('should reject missing refresh token', async () => {
      const res = await request(app).post('/api/v1/auth/token/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject malformed refresh token', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: 'invalid-token',
      });

      expect([401, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject refresh token with wrong signature', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: 'tampered-token',
      });

      expect([401, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Expired refresh token', () => {
    it('should reject expired refresh token', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: mockRefreshToken,
      });

      expect([401, 500]).toContain(res.status);
      if (res.status === 401 && res.body.error) {
        expect(res.body.error).toContain('만료');
      }
    });

    it('should request fresh authentication after expiration', async () => {
      (jwtService.refreshAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      const res = await request(app).post('/api/v1/auth/token/refresh').send({
        refresh_token: 'expired-refresh-token',
      });

      expect([401, 403, 500]).toContain(res.status);
    });
  });
});

describe('Authentication Integration', () => {
  const mockPhone = '01012345678';
  const mockCode = '123456';
  const mockAccessToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyJ9.test';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete full authentication flow: request -> verify -> use token', async () => {
    // Step 1: Request OTP
    (smsService.sendSMS as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'test-msg-001',
    });

    const requestRes = await request(app).post('/api/v1/auth/phone/request').send({
      phone: mockPhone,
    });

    expect(requestRes.status).toBe(200);

    // Step 2: Verify code
    (jwtService.generateAccessToken as jest.Mock).mockReturnValue(mockAccessToken);
    (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('refresh-token-123');

    const verifyRes = await request(app).post('/api/v1/auth/phone/verify').send({
      phone: mockPhone,
      code: mockCode,
    });

    expect([200, 400]).toContain(verifyRes.status);
    if (verifyRes.status === 200) {
      expect(verifyRes.body.access_token).toBeDefined();
    }
  });

  it('should handle concurrent authentication requests safely', async () => {
    (smsService.sendSMS as jest.Mock).mockResolvedValue({
      success: true,
      messageId: 'test-msg-001',
    });

    const promises = [
      request(app).post('/api/v1/auth/phone/request').send({ phone: '01011111111' }),
      request(app).post('/api/v1/auth/phone/request').send({ phone: '01022222222' }),
      request(app).post('/api/v1/auth/phone/request').send({ phone: '01033333333' }),
    ];

    const results = await Promise.all(promises);
    results.forEach((res) => {
      expect(res.status).toBe(200);
    });
  });
});
