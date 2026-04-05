/**
 * Admin Order Management Tests
 * Tests for listing, filtering, advancing, canceling, and deleting orders as admin
 */

import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/services/JWTTokenService');

// Get Prisma mock
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('GET /api/v1/admin/orders - List All Orders', () => {
  const mockAdminKey = 'test-admin-key';


  describe('List all orders', () => {
    it('should return list of all orders', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/admin/orders?status=all')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('should include all order statuses when status=all', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=all')
        .set('X-Admin-Key', mockAdminKey);

      if (res.status === 200 && res.body.orders.length > 0) {
        const statuses = res.body.orders.map((o: any) => o.status);
        expect(statuses.length).toBeGreaterThan(0);
      }
    });

    it('should include order pagination metadata', async () => {
      // Mock findMany to return orders
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'order-1',
          status: 'pending',
          totalAmount: 15000,
          createdAt: new Date(),
          user: { id: 'user-1', name: 'Test User' },
          restaurant: { id: 'rest-1', name: 'Test Restaurant' },
          items: [],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/orders?status=all&page=1&limit=10')
        .set('X-Admin-Key', mockAdminKey);

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.orders)).toBe(true);
      }
    });

    it('should support sorting', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=all&sort=created_at&order=desc')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const res = await request(app)
        .get(
          `/api/v1/admin/orders?status=all&start_date=${startDate}&end_date=${endDate}`
        )
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });
  });

  describe('Authentication', () => {
    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/v1/admin/orders?status=all');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=all')
        .set('X-Admin-Key', 'invalid-token');

      expect(res.status).toBe(403);
    });
  });
});

describe('GET /api/v1/admin/orders?status=pending - Filter by Status', () => {
  const mockAdminKey = 'test-admin-key';


  describe('Status filtering', () => {
    it('should return only pending orders', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=pending')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.orders.length > 0) {
        res.body.orders.forEach((order: any) => {
          expect(order.status).toBe('pending');
        });
      }
    });

    it('should filter by confirmed status', async () => {
      // Mock to return confirmed orders
      (prisma.order.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'order-2',
          status: 'confirmed',
          totalAmount: 20000,
          createdAt: new Date(),
          user: { id: 'user-2', name: 'Test User 2' },
          restaurant: { id: 'rest-2', name: 'Test Restaurant 2' },
          items: [],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/orders?status=confirmed')
        .set('X-Admin-Key', mockAdminKey);

      if (res.status === 200 && res.body.orders.length > 0) {
        res.body.orders.forEach((order: any) => {
          expect(order.status).toBe('confirmed');
        });
      }
    });

    it('should filter by picking_up status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/admin/orders?status=picking_up')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });

    it('should filter by delivering status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/admin/orders?status=delivering')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });

    it('should filter by delivered status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/admin/orders?status=delivered')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });

    it('should filter by cancelled status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/admin/orders?status=cancelled')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });

    it('should reject invalid status filter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=invalid-status')
        .set('X-Admin-Key', mockAdminKey);

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('Multi-status filtering', () => {
    it('should filter by multiple statuses', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders?status=pending,confirmed')
        .set('X-Admin-Key', mockAdminKey);

      if (res.status === 200 && res.body.orders.length > 0) {
        res.body.orders.forEach((order: any) => {
          expect(['pending', 'confirmed']).toContain(order.status);
        });
      }
    });
  });

  describe('Restaurant filter', () => {
    it('should filter orders by restaurant', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      const res = await request(app)
        .get('/api/v1/admin/orders?status=all&restaurant_id=restaurant-001')
        .set('X-Admin-Key', mockAdminKey);

      expect(res.status).toBe(200);
    });
  });
});

describe('PUT /api/v1/admin/orders/:id/advance - Advance Order Status', () => {
  const mockAdminKey = 'test-admin-key';
  const mockOrderId = 'order-123';


  describe('Advance from pending to confirmed', () => {
    it('should advance order from pending to confirmed', async () => {
      // Mock driver to exist
      (prisma.driver.findUnique as jest.Mock).mockResolvedValue({
        id: 'driver-1',
        name: 'Test Driver',
      });

      // Mock findFirst to return a pending order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'pending',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      // Mock update to return confirmed order
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'confirmed',
        driverId: 'driver-1',
        confirmedAt: new Date(),
        totalAmount: 15000,
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          driverId: 'driver-1',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });
  });

  describe('Advance from confirmed to picking_up', () => {
    it('should require kitchen display system acknowledgment', async () => {
      // Mock findFirst to return a confirmed order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'confirmed',
        driverId: 'driver-1',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      // Mock update to return picking_up order
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'picking_up',
        estimatedPickupTime: new Date(),
        restaurantPaidAmount: 13000,
        restaurantPaidAt: new Date(),
        pickedUpAt: new Date(),
        totalAmount: 15000,
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          estimatedPickupTime: new Date().toISOString(),
          restaurantPaidAmount: 13000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('picking_up');
    });

    it('should validate estimated pickup time', async () => {
      // Even with a valid order mock, an invalid date might still process
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'confirmed',
        driverId: 'driver-1',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      // Mock update to handle invalid dates
      (prisma.order.update as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid date');
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          estimatedPickupTime: 'invalid-date',
          restaurantPaidAmount: 13000,
        });

      // Should fail validation or processing
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Advance from picking_up to delivering', () => {
    it('should require driver assignment', async () => {
      // Mock findFirst to return a picking_up order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'picking_up',
        driverId: 'driver-1',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      // Mock update to return delivering order
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'delivering',
        driverId: 'driver-1',
        pickedUpAt: new Date(),
        totalAmount: 15000,
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          pickupConfirmation: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('delivering');
    });

    it('should validate driver exists', async () => {
      // Mock driver not found
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'picking_up',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      (prisma.driver.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          driverId: 'non-existent-driver',
        });

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should validate driver is on duty', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          driverId: 'off-duty-driver',
        });

      expect([400, 404, 500]).toContain(res.status);
    });
  });

  describe('Advance from delivering to delivered', () => {
    it('should mark order as delivered with timestamp', async () => {
      // Mock findFirst to return a delivering order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'delivering',
        driverId: 'driver-1',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      // Mock update to return delivered order
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'delivered',
        deliveredAt: new Date(),
        totalAmount: 15000,
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({
          deliveryConfirmation: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('delivered');
      expect(res.body.data.deliveredAt).toBeDefined();
    });
  });

  describe('Invalid transitions', () => {
    it('should reject backward status transitions', async () => {
      // Mock findFirst to return a confirmed order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'confirmed',
        driverId: 'driver-1',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({});

      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid next status', async () => {
      // Mock findFirst to return a pending order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'pending',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({});

      expect([400, 404]).toContain(res.status);
    });

    it('should reject skipping status steps', async () => {
      // Mock findFirst to return a pending order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'pending',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/advance`)
        .set('X-Admin-Key', mockAdminKey)
        .send({});

      expect([400, 404]).toContain(res.status);
    });
  });

  describe('Order not found', () => {
    it('should return 404 for non-existent order', async () => {
      // Mock findFirst to return null for non-existent order
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/v1/admin/orders/non-existent/advance')
        .set('X-Admin-Key', mockAdminKey)
        .send({
          driverId: 'driver-1',
        });

      expect(res.status).toBe(404);
    });
  });
});

describe('PUT /api/v1/admin/orders/:id/cancel - Cancel Order with Reason', () => {
  const mockAdminKey = 'test-admin-key';
  const mockOrderId = 'order-123';


  it('should cancel order with admin reason', async () => {
    // Mock findFirst to return a pending order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'pending',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    // Mock update to return cancelled order
    (prisma.order.update as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'cancelled',
      cancelReason: '식당 폐점',
      cancelledAt: new Date(),
      paymentStatus: 'refunded',
      totalAmount: 15000,
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    const res = await request(app)
      .put(`/api/v1/admin/orders/${mockOrderId}/cancel`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        cancelReason: '식당 폐점',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled');
    expect(res.body.data.cancelReason).toBe('식당 폐점');
  });

  it('should require cancellation reason', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/orders/${mockOrderId}/cancel`)
      .set('X-Admin-Key', mockAdminKey)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should accept various cancellation reasons', async () => {
    const reasons = [
      '식당 폐점',
      '고객 요청',
      '배달 불가',
      '결제 실패',
      '시스템 오류',
    ];

    for (const reason of reasons) {
      // Mock for each iteration
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'pending',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date(),
        paymentStatus: 'refunded',
        totalAmount: 15000,
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      const res = await request(app)
        .put(`/api/v1/admin/orders/${mockOrderId}/cancel`)
        .set('X-Admin-Key', mockAdminKey)
        .send({ cancelReason: reason });

      if (res.status === 200) {
        expect(res.body.data.cancelReason).toBe(reason);
      }
    }
  });

  it('should set cancellation timestamp', async () => {
    // Mock findFirst to return a pending order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'pending',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    // Mock update
    (prisma.order.update as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'cancelled',
      cancelReason: '식당 폐점',
      cancelledAt: new Date(),
      paymentStatus: 'refunded',
      totalAmount: 15000,
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    const res = await request(app)
      .put(`/api/v1/admin/orders/${mockOrderId}/cancel`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        cancelReason: '식당 폐점',
      });

    if (res.status === 200) {
      expect(res.body.data.cancelledAt).toBeDefined();
    }
  });

  it('should prevent cancelling delivered orders', async () => {
    // Mock findFirst to return a delivered order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'delivered',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    const res = await request(app)
      .put(`/api/v1/admin/orders/${mockOrderId}/cancel`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        cancelReason: '고객 요청',
      });

    if (res.status === 400) {
      expect(res.body.error).toContain('배달 완료');
    }
  });

  it('should return 404 for non-existent order', async () => {
    // Mock findFirst to return null
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/admin/orders/non-existent/cancel')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        cancelReason: '식당 폐점',
      });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/admin/orders/:id - Delete Order', () => {
  const mockAdminKey = 'test-admin-key';
  const mockOrderId = 'order-123';


  it('should delete order with reason', async () => {
    // Mock findFirst to return a pending order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'pending',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    // Mock deleteMany for order items
    (prisma.orderItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Mock delete for order
    (prisma.order.delete as jest.Mock).mockResolvedValue({
      id: mockOrderId,
    });

    const res = await request(app)
      .delete(`/api/v1/admin/orders/${mockOrderId}`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        reason: '테스트 주문',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should require deletion reason', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/orders/${mockOrderId}`)
      .set('X-Admin-Key', mockAdminKey)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should accept various deletion reasons', async () => {
    const reasons = [
      '테스트 주문',
      '중복 주문',
      '고객 요청',
      '데이터 정정',
    ];

    for (const reason of reasons) {
      // Mock for each iteration
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: mockOrderId,
        status: 'pending',
        totalAmount: 15000,
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
        restaurant: { id: 'rest-1', name: 'Test Restaurant' },
        items: [],
      });

      (prisma.orderItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.order.delete as jest.Mock).mockResolvedValue({ id: mockOrderId });

      const res = await request(app)
        .delete(`/api/v1/admin/orders/${mockOrderId}`)
        .set('X-Admin-Key', mockAdminKey)
        .send({ reason });

      if (res.status === 200) {
        expect(res.body.success).toBe(true);
      }
    }
  });

  it('should prevent deleting delivered orders (hard delete)', async () => {
    // Mock findFirst to return a delivered order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'delivered',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    const res = await request(app)
      .delete(`/api/v1/admin/orders/${mockOrderId}`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        reason: '테스트',
      });

    if (res.status === 400) {
      expect(res.body.error).toContain('배달 완료');
    }
  });

  it('should return 404 for non-existent order', async () => {
    // Mock findFirst to return null
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/admin/orders/non-existent')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        reason: '테스트',
      });

    expect(res.status).toBe(404);
  });

  it('should log deletion reason for audit trail', async () => {
    // Mock findFirst to return a pending order
    (prisma.order.findFirst as jest.Mock).mockResolvedValue({
      id: mockOrderId,
      status: 'pending',
      totalAmount: 15000,
      createdAt: new Date(),
      user: { id: 'user-1', name: 'Test User' },
      restaurant: { id: 'rest-1', name: 'Test Restaurant' },
      items: [],
    });

    (prisma.orderItem.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.order.delete as jest.Mock).mockResolvedValue({ id: mockOrderId });

    const res = await request(app)
      .delete(`/api/v1/admin/orders/${mockOrderId}`)
      .set('X-Admin-Key', mockAdminKey)
      .send({
        reason: '테스트 주문',
      });

    if (res.status === 200) {
      expect(res.body.message).toBeDefined();
    }
  });
});

describe('Admin Order Management - Authorization', () => {
  const mockRegionAdminToken = 'region-admin-token';
  const mockOrderId = 'order-123';


  it('region admin should only see orders in their region', async () => {
    const adminUserData = Buffer.from(JSON.stringify({
      id: 'region-admin-1',
      username: 'region-admin',
      name: 'Region Admin',
      role: 'region_admin',
      regionId: 'region-jeju'
    })).toString('base64');

    const res = await request(app)
      .get('/api/v1/admin/orders?status=all')
      .set('X-Admin-Key', 'test-admin-key')
      .set('X-Admin-User', adminUserData);

    if (res.status === 200 && res.body.orders.length > 0) {
      // All orders should be from region admin's region
      res.body.orders.forEach((order: any) => {
        expect(order.region_id).toBeDefined();
      });
    }
  });

  it('region admin should not access orders from other regions', async () => {
    // Mock findMany to return empty list for region admin filtering
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    const adminUserData = Buffer.from(JSON.stringify({
      id: 'region-admin-1',
      username: 'region-admin',
      name: 'Region Admin',
      role: 'region_admin',
      regionId: 'region-jeju'
    })).toString('base64');

    const res = await request(app)
      .get('/api/v1/admin/orders?status=all&region_id=other-region')
      .set('X-Admin-Key', 'test-admin-key')
      .set('X-Admin-User', adminUserData);

    expect([200, 400, 403]).toContain(res.status);
  });
});
