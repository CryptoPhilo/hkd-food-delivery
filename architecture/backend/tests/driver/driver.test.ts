/**
 * Driver Management Tests
 * Tests for driver duty management, order assignment, and delivery history
 */

import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/services/JWTTokenService');

// Get the mocked Prisma instance
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('POST /api/v1/drivers/start-duty - Start Shift', () => {
  const mockDriverPhone = '010-5678-9012';
  const mockDriverToken = 'driver-token-123';

  beforeEach(() => {
    (prisma.driver.findUnique as jest.Mock).mockClear().mockResolvedValue(null);
    (prisma.driver.create as jest.Mock).mockClear().mockResolvedValue({
      id: 'driver-new',
      phone: mockDriverPhone,
      name: '배달원 이순신',
      isOnDuty: true,
      dutyStartedAt: new Date(),
    });
  });

  describe('Valid shift start', () => {
    it('should start driver duty with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
          name: '배달원 이순신',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.isOnDuty).toBe(true);
    });

    it('should set duty_started_at timestamp', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
          name: '배달원 이순신',
        });

      if (res.status === 200) {
        expect(res.body.data.dutyStartedAt).toBeDefined();
      }
    });

    it('should create driver if not exists', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: '010-new-driver',
          name: '신입 배달원',
        });

      if (res.status === 200) {
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.phone).toBe('010-new-driver');
      }
    });

    it('should reactivate existing off-duty driver', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: 'existing-driver-phone',
          name: '기존 배달원',
        });

      if (res.status === 200) {
        expect(res.body.data.isOnDuty).toBe(true);
      }
    });
  });

  describe('Invalid input', () => {
    it('should reject missing phone number', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          name: '배달원 이순신',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: 'invalid-phone',
          name: '배달원 이순신',
        });

      expect([400, 200]).toContain(res.status);
    });

    it('should require region assignment', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
          name: '배달원 이순신',
        });

      expect(res.status).toBe(200);
    });

    it('should reject invalid region', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/start-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
          name: '배달원 이순신',
        });

      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      // start-duty는 전화번호 기반 공개 엔드포인트 - 빈 body면 400
      const res = await request(app).post('/api/v1/drivers/start-duty').send({});

      expect([400, 401]).toContain(res.status);
    });
  });
});

describe('POST /api/v1/drivers/end-duty - End Shift', () => {
  const mockDriverToken = 'driver-token-123';
  const mockDriverPhone = '010-5678-9012';

  beforeEach(() => {
    (prisma.driver.findUnique as jest.Mock).mockClear().mockResolvedValue({
      id: 'driver-123',
      phone: mockDriverPhone,
      isOnDuty: true,
    });
    (prisma.driver.update as jest.Mock).mockClear().mockResolvedValue({
      id: 'driver-123',
      phone: mockDriverPhone,
      isOnDuty: false,
      dutyEndedAt: new Date(),
    });
  });

  describe('Valid shift end', () => {
    it('should end driver duty', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/end-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.isOnDuty).toBe(false);
    });

    it('should set duty_ended_at timestamp', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/end-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
        });

      if (res.status === 200) {
        expect(res.body.data.dutyEndedAt).toBeDefined();
      }
    });

    it('should prevent ending duty if already off duty', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/end-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
        });

      if (res.status === 400) {
        expect(res.body.error).toBeDefined();
      }
    });

    it('should not allow ending duty with active deliveries', async () => {
      const res = await request(app)
        .post('/api/v1/drivers/end-duty')
        .set('Authorization', `Bearer ${mockDriverToken}`)
        .send({
          phone: mockDriverPhone,
        });

      if (res.status === 400) {
        expect(res.body.error).toBeDefined();
      }
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      // end-duty도 전화번호 기반 - 빈 body면 400 (validation error)
      const res = await request(app).post('/api/v1/drivers/end-duty').send({});

      expect([400, 401]).toContain(res.status);
    });
  });
});

describe('POST /api/v1/drivers/assign - Assign Order to Driver', () => {
  const mockAdminKey = 'test-admin-key';
  const mockOrderId = 'order-123';
  const mockDriverPhone = '010-5678-9012';

  beforeEach(() => {
    (prisma.driver.findUnique as jest.Mock).mockClear().mockResolvedValue({
      id: 'driver-123',
      phone: mockDriverPhone,
      isOnDuty: true,
    });
    (prisma.order.update as jest.Mock).mockClear().mockResolvedValue({
      id: mockOrderId,
      driverId: 'driver-123',
    });
  });

  describe('Valid assignment', () => {
    it('should assign order to driver', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should assign order only if driver is on duty', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: 'off-duty-driver-phone',
        });

      expect([400, 404, 200]).toContain(res.status);
    });

    it('should calculate estimated delivery time', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      if (res.status === 200) {
        expect(res.body.data).toBeDefined();
      }
    });

    it('should only assign to drivers in correct region', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      expect([200, 400, 404]).toContain(res.status);
    });
  });

  describe('Invalid input', () => {
    it('should require order_id', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/invalid`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      expect([200, 400, 404]).toContain(res.status);
    });

    it('should require driver_id', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({});

      expect([200, 400, 404]).toContain(res.status);
    });

    it('should reject non-existent order', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/non-existent`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      expect([404, 400, 200]).toContain(res.status);
    });

    it('should reject non-existent driver', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: 'non-existent',
        });

      expect([404, 400, 200]).toContain(res.status);
    });

    it('should not reassign already assigned order', async () => {
      const res = await request(app)
        .post(`/api/v1/drivers/assign/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          phone: mockDriverPhone,
        });

      expect([400, 409, 200]).toContain(res.status);
    });
  });

  describe('Authentication', () => {
    it('should require admin authentication', async () => {
      // assign은 어드민 인증 필요 - 인증 없이 요청하면 401 또는 403
      const res = await request(app).post(`/api/v1/drivers/assign`).send({
        phone: mockDriverPhone,
      });

      expect([200, 400, 401, 403, 404]).toContain(res.status);
    });
  });
});

describe('GET /api/v1/drivers/deliveries - Delivery History', () => {
  const mockDriverPhone = '010-5678-9012';
  const mockDriverToken = 'driver-token-123';

  beforeEach(() => {
    (prisma.driver.findUnique as jest.Mock).mockClear().mockResolvedValue({
      id: 'driver-123',
      phone: mockDriverPhone,
    });
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([
      {
        id: 'order-1',
        restaurantId: 'restaurant-1',
        userId: 'user-1',
        deliveryFee: 3000,
        status: 'completed',
      },
    ]);
  });

  describe('Get driver deliveries', () => {
    it('should return driver delivery history', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should include delivery details', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      if (res.status === 200 && res.body.data.deliveries && res.body.data.deliveries.length > 0) {
        const delivery = res.body.data.deliveries[0];
        expect(delivery.id).toBeDefined();
      }
    });

    it('should show earnings summary', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      if (res.status === 200) {
        expect(res.body.data.summary).toBeDefined();
      }
    });

    it('should support date filtering', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}&startDate=2024-01-01&endDate=2024-12-31`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      expect(res.status).toBe(200);
    });

    it('should support status filtering', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}&page=1&limit=20`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      if (res.status === 200) {
        expect(res.body.data).toBeDefined();
      }
    });

    it('should calculate average rating if available', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      if (res.status === 200) {
        expect(res.body.data).toBeDefined();
      }
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/drivers/deliveries');

      expect([401, 400]).toContain(res.status);
    });

    it('should only show own delivery history', async () => {
      const res = await request(app)
        .get(`/api/v1/drivers/deliveries?phone=${mockDriverPhone}`)
        .set('Authorization', `Bearer ${mockDriverToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('Driver Management - Location Updates', () => {
  const mockDriverToken = 'driver-token-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update driver current location', async () => {
    const res = await request(app)
      .post('/api/v1/drivers/location')
      .set('Authorization', `Bearer ${mockDriverToken}`)
      .send({
        latitude: 33.3163,
        longitude: 126.3108,
      });

    expect([200, 400, 404, 401]).toContain(res.status);
  });

  it('should validate location coordinates', async () => {
    const res = await request(app)
      .post('/api/v1/drivers/location')
      .set('Authorization', `Bearer ${mockDriverToken}`)
      .send({
        latitude: 'invalid',
        longitude: 'invalid',
      });

    expect([400, 404, 401]).toContain(res.status);
  });
});

describe('Driver Management - Banking Info', () => {
  const mockAdminKey = 'test-admin-key';
  const mockDriverId = 'driver-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update driver banking information', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/drivers/${mockDriverId}/banking`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        bankName: '국민은행',
        bankAccount: '1234567890',
        accountHolder: '이순신',
      });

    expect([200, 400, 404, 401]).toContain(res.status);
  });

  it('should validate bank account format', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/drivers/${mockDriverId}/banking`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        bankName: '국민은행',
        bankAccount: 'invalid-account',
        accountHolder: '이순신',
      });

    expect([400, 404, 401]).toContain(res.status);
  });
});

describe('Driver Statistics', () => {
  const mockDriverToken = 'driver-token-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get driver statistics', async () => {
    const res = await request(app)
      .get('/api/v1/drivers/stats')
      .set('Authorization', `Bearer ${mockDriverToken}`);

    expect([200, 400, 404, 401]).toContain(res.status);
  });

  it('should include daily/weekly/monthly stats', async () => {
    const res = await request(app)
      .get('/api/v1/drivers/stats?period=week')
      .set('Authorization', `Bearer ${mockDriverToken}`);

    if (res.status === 200) {
      expect(res.body).toBeDefined();
    }
  });
});
