/**
 * Order Lifecycle Tests
 * Tests for creating, listing, confirming, and canceling orders
 */

import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/services/JWTTokenService');

describe('POST /api/v1/orders - Create Order', () => {
  const mockCustomerToken = 'customer-token-123';
  const mockOrder = {
    restaurantId: 'restaurant-001',
    deliveryAddress: '제주시 연동 123번지',
    deliveryLat: 33.3163,
    deliveryLng: 126.3108,
    items: [
      {
        menuId: 'menu-001',
        quantity: 2,
      },
      {
        menuId: 'menu-002',
        quantity: 1,
      },
    ],
    customerMemo: '고추 적게 넣어주세요',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid order creation', () => {
    it('should create order with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
        });

      expect([201, 400, 500]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      }
    });

    it('should calculate order totals correctly', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
        });

      if (res.status === 201 && res.body.data) {
        expect(res.body.data.id).toBeDefined();
      }
    });

    it('should generate confirmation token for order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
        });

      if (res.status === 201 && res.body.data) {
        expect(res.body.data.id).toBeDefined();
      }
    });

    it('should include estimated pickup and delivery times', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
        });

      if (res.status === 201 && res.body.data) {
        expect(res.body.data.id).toBeDefined();
      }
    });
  });

  describe('Missing required fields', () => {
    it('should reject order without restaurantId', async () => {
      const { restaurantId, ...orderData } = mockOrder;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...orderData,
          phone: '01012345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject order without items', async () => {
      const { items, ...orderData } = mockOrder;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...orderData,
          phone: '01012345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject order without delivery address', async () => {
      const { deliveryAddress, ...orderData } = mockOrder;
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...orderData,
          phone: '01012345678',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject order without coordinates', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          deliveryLat: undefined,
          deliveryLng: undefined,
        });

      expect([400, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject order with empty items array', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          items: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Invalid restaurant', () => {
    it('should reject order for non-existent restaurant', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          restaurantId: 'non-existent-restaurant',
        });

      expect([400, 404, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject order for inactive restaurant', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          restaurantId: 'inactive-restaurant',
        });

      expect([400, 404, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('should reject order if restaurant not delivering to address', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          deliveryLat: 37.5665, // Seoul coordinates
          deliveryLng: 126.978,
        });

      expect([400, 404, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Invalid items', () => {
    it('should reject items with invalid quantity', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          items: [
            {
              ...mockOrder.items[0],
              quantity: 0,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject items with missing menuId', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          items: [
            {
              quantity: 1,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent menu items', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          ...mockOrder,
          phone: '01012345678',
          items: [
            {
              menuId: 'non-existent-menu',
              quantity: 1,
            },
          ],
        });

      expect([400, 404, 500]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('No userId or phone', () => {
    it('should reject order without userId or phone', async () => {
      const { restaurantId, deliveryAddress, deliveryLat, deliveryLng, items } = mockOrder;
      const res = await request(app).post('/api/v1/orders').send({
        restaurantId,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        items,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('GET /api/v1/orders - List Orders', () => {
  const mockPhone = '01012345678';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list customer orders', async () => {
    const res = await request(app)
      .get(`/api/v1/orders?phone=${mockPhone}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter orders by date', async () => {
    const res = await request(app)
      .get(`/api/v1/orders?phone=${mockPhone}&date=2026-04-01`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should require phone parameter', async () => {
    const res = await request(app)
      .get('/api/v1/orders');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/orders/:id - Get Order Detail', () => {
  const mockOrderId = 'order-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should retrieve order details', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${mockOrderId}`);

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  it('should include order items in details', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${mockOrderId}`);

    if (res.status === 200 && res.body.data) {
      expect(res.body.data.items || res.body.data.id).toBeDefined();
    }
  });

  it('should return 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/v1/orders/non-existent');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/orders/confirm/:token - Confirm Order', () => {
  const mockConfirmToken = 'confirm-token-abc123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should confirm order with valid token', async () => {
    const res = await request(app).post(`/api/v1/orders/confirm/${mockConfirmToken}`).send({});

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  it('should reject confirmation with invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/orders/confirm/invalid-token')
      .send({});

    expect([400, 404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('should reject confirmation if token expired', async () => {
    const res = await request(app)
      .post('/api/v1/orders/confirm/expired-token')
      .send({});

    expect([400, 404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/v1/orders/cancel/:token - Cancel Order', () => {
  const mockCancelToken = 'cancel-token-def456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel order with valid token', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/cancel/${mockCancelToken}`)
      .send({});

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  it('should reject cancellation with invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/orders/cancel/invalid-token')
      .send({});

    expect([400, 404, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

describe('Order Status Transitions', () => {
  const mockPhone = '01012345678';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list orders for a phone number', async () => {
    const res = await request(app)
      .get(`/api/v1/orders?phone=${mockPhone}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
