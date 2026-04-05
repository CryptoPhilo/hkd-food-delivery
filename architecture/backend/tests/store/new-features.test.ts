/**
 * 신규 기능 테스트
 * - 표준 카테고리 검증
 * - 영업시간 검증 완화
 * - 페이지네이션 limit 500
 * - isRecommended 토글
 * - category-order-counts API
 * - weekly-hot API
 */

import request from 'supertest';
import app from '../../src/app';

jest.mock('../../src/services/JWTTokenService');

// Get the mocked Prisma instance
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mockAdminKey = 'test-admin-key';

// ================================================
// 1. 표준 카테고리 검증
// ================================================
describe('Standard Category Validation', () => {
  const validCategories = ['한식', '중식', '양식/피자', '치킨', '분식', '고기/구이', '횟집', '카페', '기타'];

  beforeEach(() => {
    (prisma.restaurant.create as jest.Mock).mockClear().mockResolvedValue({
      id: 'restaurant-new',
      name: '테스트 식당',
      address: '제주시 한경면 테스트길 123',
      category: '한식',
      menus: [],
    });
    (prisma.restaurant.update as jest.Mock).mockClear().mockResolvedValue({
      id: 'restaurant-1',
      name: '테스트 식당',
      category: '한식',
    });
  });

  validCategories.forEach((cat) => {
    it(`should accept valid category: ${cat}`, async () => {
      const res = await request(app)
        .post('/api/v1/admin/restaurants')
        .set('X-Admin-Key', mockAdminKey)
        .send({
          name: '테스트 식당',
          address: '제주시 한경면 테스트길 123',
          latitude: 33.3,
          longitude: 126.3,
          regionId: 'region-jeju-hangyeong',
          category: cat,
        });

      expect(res.status).toBe(200);
    });
  });

  it('should reject invalid category on create', async () => {
    const res = await request(app)
      .post('/api/v1/admin/restaurants')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        name: '테스트 식당',
        address: '제주시 한경면 테스트길 123',
        latitude: 33.3,
        longitude: 126.3,
        regionId: 'region-jeju-hangyeong',
        category: '음식점 > 한식 > 고기',
      });

    expect(res.status).toBe(400);
    expect(res.body.details?.join(' ') || res.body.error).toContain('카테고리');
  });

  it('should reject invalid category on update', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        category: 'invalid-category',
      });

    expect(res.status).toBe(400);
    expect(res.body.details?.join(' ') || res.body.error).toContain('카테고리');
  });

  it('should allow null category on update', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        category: null,
      });

    // null은 검증 통과 (카테고리 미지정 허용)
    expect([200, 400]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).not.toContain('카테고리');
    }
  });

  it('should skip category validation for convenience_store', async () => {
    const res = await request(app)
      .post('/api/v1/admin/restaurants')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        name: 'CU 한경점',
        address: '제주시 한경면 편의점길 1',
        latitude: 33.3,
        longitude: 126.3,
        regionId: 'region-jeju-hangyeong',
        storeType: 'convenience_store',
        category: '편의점 자유카테고리',
      });

    // 편의점은 카테고리 검증 안 함
    expect(res.status).toBe(200);
  });
});

// ================================================
// 2. 영업시간 검증 완화
// ================================================
describe('Business Hours Validation (Relaxed)', () => {
  beforeEach(() => {
    (prisma.restaurant.create as jest.Mock).mockClear().mockResolvedValue({
      id: 'restaurant-new',
      name: '테스트 식당',
      address: '제주시 한경면 테스트길 123',
      businessHours: '11:00-19:40',
      menus: [],
    });
    (prisma.restaurant.update as jest.Mock).mockClear().mockResolvedValue({
      id: 'restaurant-1',
      businessHours: '11:00-19:40 (화요일 휴무)',
    });
  });

  it('should accept simple HH:MM-HH:MM format', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ businessHours: '10:00-22:00' });

    expect(res.status).toBe(200);
  });

  it('should accept HH:MM-HH:MM with additional info', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ businessHours: '11:00-19:40 (화요일 휴무, 브레이크타임 14:40-17:30)' });

    expect(res.status).toBe(200);
  });

  it('should accept HH:MM-HH:MM on create too', async () => {
    const res = await request(app)
      .post('/api/v1/admin/restaurants')
      .set('X-Admin-Key', mockAdminKey)
      .send({
        name: '새 식당',
        address: '제주시 한경면 테스트길 456',
        latitude: 33.3,
        longitude: 126.3,
        regionId: 'region-jeju-hangyeong',
        category: '한식',
        businessHours: '09:00-21:00 (일요일 휴무)',
      });

    expect(res.status).toBe(200);
  });

  it('should reject businessHours without HH:MM-HH:MM pattern', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ businessHours: '아침부터 저녁까지' });

    expect(res.status).toBe(400);
    expect(res.body.details?.join(' ') || res.body.error).toContain('영업시간');
  });

  it('should reject businessHours over 200 chars', async () => {
    const longHours = '10:00-22:00 ' + '아'.repeat(200);
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ businessHours: longHours });

    expect(res.status).toBe(400);
    expect(res.body.details?.join(' ') || res.body.error).toContain('200자');
  });

  it('should allow null businessHours', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ businessHours: null });

    expect(res.status).toBe(200);
  });
});

// ================================================
// 3. 페이지네이션 limit 500
// ================================================
describe('Pagination Limit 500', () => {
  beforeEach(() => {
    (prisma.restaurant.findMany as jest.Mock).mockClear().mockResolvedValue([]);
  });

  it('should accept limit=500 for restaurant list', async () => {
    const res = await request(app)
      .get('/api/v1/restaurants?limit=500');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should accept limit=100 for restaurant list', async () => {
    const res = await request(app)
      .get('/api/v1/restaurants?limit=100');

    expect(res.status).toBe(200);
  });

  it('should reject limit=501 for restaurant list', async () => {
    const res = await request(app)
      .get('/api/v1/restaurants?limit=501');

    expect(res.status).toBe(400);
  });

  it('should default to limit=20 when not specified', async () => {
    const res = await request(app)
      .get('/api/v1/restaurants');

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(20);
  });
});

// ================================================
// 4. isRecommended 토글
// ================================================
describe('isRecommended Toggle', () => {
  beforeEach(() => {
    (prisma.restaurant.update as jest.Mock).mockClear().mockResolvedValue({
      id: 'restaurant-1',
      name: '추천 식당',
      isRecommended: true,
    });
  });

  it('should toggle isRecommended to true', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ isRecommended: true });

    expect(res.status).toBe(200);
    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isRecommended: true }),
      })
    );
  });

  it('should toggle isRecommended to false', async () => {
    (prisma.restaurant.update as jest.Mock).mockResolvedValue({
      id: 'restaurant-1',
      isRecommended: false,
    });

    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ isRecommended: false });

    expect(res.status).toBe(200);
    expect(prisma.restaurant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isRecommended: false }),
      })
    );
  });

  it('should not affect isRecommended when not sent', async () => {
    const res = await request(app)
      .put('/api/v1/admin/restaurants/restaurant-1')
      .set('X-Admin-Key', mockAdminKey)
      .send({ name: '이름만 변경' });

    expect(res.status).toBe(200);
    const updateCall = (prisma.restaurant.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('isRecommended');
  });
});

// ================================================
// 5. category-order-counts API
// ================================================
describe('GET /api/v1/restaurants/category-order-counts', () => {
  it('should return category order counts', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([
      { restaurant: { category: '한식', storeType: 'restaurant', brandName: null } },
      { restaurant: { category: '한식', storeType: 'restaurant', brandName: null } },
      { restaurant: { category: '치킨', storeType: 'restaurant', brandName: null } },
      { restaurant: { category: '카페', storeType: 'restaurant', brandName: null } },
    ]);

    const res = await request(app)
      .get('/api/v1/restaurants/category-order-counts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data['한식']).toBe(2);
    expect(res.body.data['치킨']).toBe(1);
    expect(res.body.data['카페']).toBe(1);
  });

  it('should filter by regionId', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([
      { restaurant: { category: '횟집', storeType: 'restaurant', brandName: null } },
    ]);

    const res = await request(app)
      .get('/api/v1/restaurants/category-order-counts?regionId=region-jeju-hangyeong');

    expect(res.status).toBe(200);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restaurant: { regionId: 'region-jeju-hangyeong' },
        }),
      })
    );
  });

  it('should group convenience stores by brandName', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([
      { restaurant: { category: null, storeType: 'convenience_store', brandName: 'CU' } },
      { restaurant: { category: null, storeType: 'convenience_store', brandName: 'CU' } },
      { restaurant: { category: null, storeType: 'convenience_store', brandName: 'GS25' } },
    ]);

    const res = await request(app)
      .get('/api/v1/restaurants/category-order-counts');

    expect(res.status).toBe(200);
    expect(res.body.data['CU']).toBe(2);
    expect(res.body.data['GS25']).toBe(1);
  });

  it('should return empty object when no orders', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/restaurants/category-order-counts');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });
});

// ================================================
// 6. weekly-hot API
// ================================================
describe('GET /api/v1/restaurants/weekly-hot', () => {
  it('should return hot restaurant IDs and order counts', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([
      { restaurantId: 'r-1' },
      { restaurantId: 'r-1' },
      { restaurantId: 'r-1' },
      { restaurantId: 'r-2' },
      { restaurantId: 'r-2' },
      { restaurantId: 'r-3' },
    ]);

    const res = await request(app)
      .get('/api/v1/restaurants/weekly-hot');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hotRestaurantIds).toBeDefined();
    expect(Array.isArray(res.body.data.hotRestaurantIds)).toBe(true);
    // r-1 (3건), r-2 (2건) → 2건 이상이므로 Hot 후보
    expect(res.body.data.hotRestaurantIds).toContain('r-1');
    expect(res.body.data.orderCounts['r-1']).toBe(3);
    expect(res.body.data.orderCounts['r-2']).toBe(2);
    // r-3 (1건) → 2건 미만이므로 Hot 아님
    expect(res.body.data.orderCounts['r-3']).toBe(1);
    expect(res.body.data.hotRestaurantIds).not.toContain('r-3');
  });

  it('should filter orders by regionId', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/restaurants/weekly-hot?regionId=region-jeju-hangyeong');

    expect(res.status).toBe(200);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restaurant: { regionId: 'region-jeju-hangyeong' },
        }),
      })
    );
  });

  it('should filter orders from the last 7 days', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([]);

    await request(app).get('/api/v1/restaurants/weekly-hot');

    const callArgs = (prisma.order.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.createdAt).toBeDefined();
    expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const diff = Math.abs(callArgs.where.createdAt.gte.getTime() - oneWeekAgo.getTime());
    // Within 5 seconds tolerance
    expect(diff).toBeLessThan(5000);
  });

  it('should return empty when no orders', async () => {
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/restaurants/weekly-hot');

    expect(res.status).toBe(200);
    expect(res.body.data.hotRestaurantIds).toEqual([]);
    expect(res.body.data.orderCounts).toEqual({});
  });

  it('should cap hot restaurants at max 10', async () => {
    // 15 restaurants, each with 5 orders → all qualify
    const orders: any[] = [];
    for (let i = 1; i <= 15; i++) {
      for (let j = 0; j < 5; j++) {
        orders.push({ restaurantId: `r-${i}` });
      }
    }
    (prisma.order.findMany as jest.Mock).mockClear().mockResolvedValue(orders);

    const res = await request(app)
      .get('/api/v1/restaurants/weekly-hot');

    expect(res.status).toBe(200);
    expect(res.body.data.hotRestaurantIds.length).toBeLessThanOrEqual(10);
  });
});

// ================================================
// 7. RESTAURANT_CATEGORIES export 확인
// ================================================
describe('RESTAURANT_CATEGORIES constant', () => {
  it('should export 9 standard categories', () => {
    const { RESTAURANT_CATEGORIES } = require('../../src/middleware/validation.middleware');
    expect(RESTAURANT_CATEGORIES).toBeDefined();
    expect(RESTAURANT_CATEGORIES.length).toBe(9);
    expect(RESTAURANT_CATEGORIES).toContain('한식');
    expect(RESTAURANT_CATEGORIES).toContain('중식');
    expect(RESTAURANT_CATEGORIES).toContain('양식/피자');
    expect(RESTAURANT_CATEGORIES).toContain('치킨');
    expect(RESTAURANT_CATEGORIES).toContain('분식');
    expect(RESTAURANT_CATEGORIES).toContain('고기/구이');
    expect(RESTAURANT_CATEGORIES).toContain('횟집');
    expect(RESTAURANT_CATEGORIES).toContain('카페');
    expect(RESTAURANT_CATEGORIES).toContain('기타');
  });
});
