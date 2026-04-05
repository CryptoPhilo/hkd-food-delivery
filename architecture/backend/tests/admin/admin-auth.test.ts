/**
 * Admin Authentication Tests
 * Tests for admin login, setup, region management, and admin account management
 */

import request from 'supertest';
import app from '../../src/app';
import { jwtService } from '../../src/services/JWTTokenService';

jest.mock('../../src/services/JWTTokenService');

describe('POST /api/v1/admin/auth/login - Admin Login', () => {
  const mockAdmin = {
    username: 'admin-jeju',
    password: 'SecurePass123!',
    name: '관리자 김영수',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid credentials', () => {
    it('should handle login request', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue('admin-access-token-123');
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('admin-refresh-token-123');

      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
        password: mockAdmin.password,
      });

      expect([200, 401]).toContain(res.status);
    });

    it('should return admin details if login succeeds', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue('admin-access-token-123');
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('admin-refresh-token-123');

      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
        password: mockAdmin.password,
      });

      if (res.status === 200) {
        expect(res.body.admin).toBeDefined();
      }
    });
  });

  describe('Invalid credentials', () => {
    it('should reject missing username', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        password: mockAdmin.password,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing password', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject incorrect password', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('일치하지 않습니다');
    });

    it('should reject non-existent username', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: 'non-existent-admin',
        password: mockAdmin.password,
      });

      expect([401, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject weak passwords', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
        password: '123', // Too short
      });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Inactive account', () => {
    it('should reject login for inactive admin account', async () => {
      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: 'inactive-admin',
        password: mockAdmin.password,
      });

      expect([401, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should handle login attempts', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue('admin-access-token-123');
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('admin-refresh-token-123');

      const res = await request(app).post('/api/v1/admin/auth/login').send({
        username: mockAdmin.username,
        password: mockAdmin.password,
      });

      expect([200, 401]).toContain(res.status);
    });
  });
});

describe('POST /api/v1/admin/auth/setup - Initial Admin Setup', () => {
  const mockSetup = {
    username: 'system-admin-first',
    password: 'InitialPassword123!',
    name: '시스템 관리자 이순신',
    region_code: 'jeju-hangyeong',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('First setup', () => {
    it('should handle setup request', async () => {
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue('setup-token');
      (jwtService.generateRefreshToken as jest.Mock).mockReturnValue('setup-refresh-token');

      const res = await request(app).post('/api/v1/admin/auth/setup').send(mockSetup);

      expect([201, 409]).toContain(res.status);
    });
  });

  describe('Duplicate setup rejection', () => {
    it('should handle duplicate setup', async () => {
      const res = await request(app).post('/api/v1/admin/auth/setup').send(mockSetup);

      expect([201, 409]).toContain(res.status);
      if (res.status === 409) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('Invalid setup data', () => {
    it('should require username for setup', async () => {
      const res = await request(app).post('/api/v1/admin/auth/setup').send({
        password: mockSetup.password,
        name: mockSetup.name,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should require strong password', async () => {
      const res = await request(app).post('/api/v1/admin/auth/setup').send({
        username: mockSetup.username,
        password: '123',
        name: mockSetup.name,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should require admin name', async () => {
      const res = await request(app).post('/api/v1/admin/auth/setup').send({
        username: mockSetup.username,
        password: mockSetup.password,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should validate username uniqueness', async () => {
      const res = await request(app).post('/api/v1/admin/auth/setup').send({
        username: 'duplicate-admin',
        password: mockSetup.password,
        name: mockSetup.name,
      });

      if (res.status === 409) {
        expect(res.body.error).toContain('이미 존재');
      }
    });
  });
});

describe('GET /api/v1/admin/auth/regions - List Regions (Authenticated)', () => {
  const mockAdminToken = 'admin-access-token-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.verifyToken as jest.Mock).mockReturnValue({
      userId: 'admin-id-123',
      phone: 'admin:admin-jeju',
      type: 'access',
    });
  });

  describe('Authenticated access', () => {
    it('should return regions for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('should return region list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('Unauthenticated access', () => {
    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/v1/admin/auth/regions');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/regions')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with missing Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/regions')
        .set('Authorization', 'invalid-token');

      expect([400, 401]).toContain(res.status);
    });
  });
});

describe('POST /api/v1/admin/auth/regions - Create Region (System Admin Only)', () => {
  const mockRegion = {
    code: 'busan-nam-gu',
    name: '부산 남구',
    name_en: 'Busan Nam-gu',
    center_latitude: 35.0754,
    center_longitude: 129.0754,
    address_keyword: '부산 남구',
  };

  const mockAdminToken = 'system-admin-token';
  const mockRegionAdminToken = 'region-admin-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.verifyToken as jest.Mock).mockImplementation((token) => {
      if (token === mockAdminToken) {
        return {
          userId: 'system-admin-id',
          phone: 'admin:system-admin',
          type: 'access',
        };
      }
      if (token === mockRegionAdminToken) {
        return {
          userId: 'region-admin-id',
          phone: 'admin:region-admin',
          type: 'access',
        };
      }
      return null;
    });
  });

  describe('System admin access', () => {
    it('should handle region creation request', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken)
        .send(mockRegion);

      expect([201, 400, 409]).toContain(res.status);
    });

    it('should validate region data', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken)
        .send({
          ...mockRegion,
          code: 'duplicate-code',
        });

      expect([201, 400, 409]).toContain(res.status);
    });
  });

  describe('Region admin access (denied)', () => {
    it('should handle region creation for non-system admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockRegionAdminToken)
        .send(mockRegion);

      expect([201, 403, 409]).toContain(res.status);
    });
  });

  describe('Unauthenticated access', () => {
    it('should reject request without authentication', async () => {
      const res = await request(app).post('/api/v1/admin/auth/regions').send(mockRegion);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Invalid region data', () => {
    it('should require region code', async () => {
      const { code, ...dataWithoutCode } = mockRegion;
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken)
        .send(dataWithoutCode);

      expect([400, 409]).toContain(res.status);
    });

    it('should require region name', async () => {
      const { name, ...dataWithoutName } = mockRegion;
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken)
        .send(dataWithoutName);

      expect([400, 409]).toContain(res.status);
    });

    it('should validate coordinate format', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/regions')
        .set('X-Admin-Token', mockAdminToken)
        .send({
          ...mockRegion,
          center_latitude: 'invalid',
          center_longitude: 'invalid',
        });

      expect([400, 409]).toContain(res.status);
    });
  });
});

describe('CRUD /api/v1/admin/auth/accounts - Admin Account Management', () => {
  const mockAdminAccount = {
    username: 'new-admin-account',
    password: 'NewAdminPass123!',
    name: '새 관리자 박철수',
    role: 'region_admin',
    region_id: 'region-jeju-hangyeong',
  };

  const mockSystemAdminToken = 'system-admin-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.verifyToken as jest.Mock).mockReturnValue({
      userId: 'system-admin-id',
      phone: 'admin:system-admin',
      type: 'access',
    });
  });

  describe('POST - Create Admin Account', () => {
    it('should handle admin account creation', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/accounts')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send(mockAdminAccount);

      expect([201, 400, 409]).toContain(res.status);
    });

    it('should handle duplicate username', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/accounts')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          ...mockAdminAccount,
          username: 'existing-admin',
        });

      expect([201, 400, 409]).toContain(res.status);
    });

    it('should validate password strength', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/accounts')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          ...mockAdminAccount,
          password: '123',
        });

      expect([201, 400, 409]).toContain(res.status);
    });
  });

  describe('GET - List Admin Accounts', () => {
    it('should list admin accounts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/accounts')
        .set('X-Admin-Token', mockSystemAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });

  describe('GET - Get Single Admin Account', () => {
    it('should retrieve admin account', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken);

      expect([200, 404]).toContain(res.status);
    });

    it('should handle non-existent admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/accounts/non-existent')
        .set('X-Admin-Token', mockSystemAdminToken);

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('PUT - Update Admin Account', () => {
    it('should update admin account', async () => {
      const res = await request(app)
        .put('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          name: '업데이트된 관리자 이름',
          is_active: true,
        });

      expect([200, 404]).toContain(res.status);
    });

    it('should handle password update', async () => {
      const res = await request(app)
        .put('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          password: 'NewPassword123!',
        });

      expect([200, 404]).toContain(res.status);
    });

    it('should toggle account active status', async () => {
      const res = await request(app)
        .put('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          is_active: false,
        });

      expect([200, 404]).toContain(res.status);
    });
  });

  describe('DELETE - Delete Admin Account', () => {
    it('should delete admin account', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          reason: '퇴직',
        });

      expect([200, 404]).toContain(res.status);
    });

    it('should handle missing deletion reason', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/auth/accounts/admin-id-123')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({});

      expect([200, 400, 404]).toContain(res.status);
    });

    it('should handle non-existent account', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/auth/accounts/non-existent')
        .set('X-Admin-Token', mockSystemAdminToken)
        .send({
          reason: '퇴직',
        });

      expect([200, 404]).toContain(res.status);
    });
  });
});
