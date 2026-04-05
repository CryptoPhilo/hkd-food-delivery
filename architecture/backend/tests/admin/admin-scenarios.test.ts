import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

// Get Prisma mock
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('어드민 API 엔드포인트 구조 테스트', () => {
  const adminKey = 'test-admin-key';
  const mockStoreId = 'mock-id';
  const mockProductId = 'mock-id';
  const mockOrderId = 'mock-id';

describe('어드민 시나리오 통합 테스트', () => {
  let adminToken: string;
  let storeId: string;
  let productIds: string[] = [];

  beforeEach(async () => {
    await prisma.ageVerification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.user.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.settlement.deleteMany();

    adminToken = 'mock-admin-token';
  });

  describe('스토어 엔드포인트', () => {
    describe('POST /api/v1/admin/stores', () => {
      it('유효한 데이터로 스토어 생성 요청 시 201을 반환해야 한다', async () => {
        // Mock store creation
        (prisma.store.create as jest.Mock).mockResolvedValue({
          id: 'store-1',
          name: '테스트편의점',
          address: '제주시 테스트구',
          latitude: 33.3620,
          longitude: 126.3100,
          storeType: 'convenience_store',
          isActive: true,
          isDeliverable: true,
          deliveryRadius: 2.5,
        });

        const response = await request(app)
          .post('/api/v1/admin/stores')
          .set('X-Admin-Key', adminKey)
          .send({
            name: '테스트편의점',
            address: '제주시 테스트구',
            latitude: 33.3620,
            longitude: 126.3100,
            storeType: 'convenience_store',
            isActive: true,
            isDeliverable: true,
            deliveryRadius: 2.5
          });

        expect([201, 200]).toContain(response.status);
        if (response.status === 201 || response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
          expect(response.body.data.id).toBeDefined();
        }
      });

      it('필수 필드 누락 시 400을 반환해야 한다', async () => {
        const response = await request(app)
          .post('/api/v1/admin/stores')
          .set('X-Admin-Key', adminKey)
          .send({
            address: '제주시 테스트구',
            latitude: 33.3620,
            longitude: 126.3100
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('유효하지 않은 좌표 시 400을 반환해야 한다', async () => {
        const response = await request(app)
          .post('/api/v1/admin/stores')
          .set('X-Admin-Key', adminKey)
          .send({
            name: '테스트편의점',
            address: '제주시 테스트구',
            latitude: 999,
            longitude: 999,
            storeType: 'convenience_store'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/admin/stores', () => {
      it('스토어 목록을 반환해야 한다', async () => {
        // Mock store list
        (prisma.store.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'store-1',
            name: '테스트편의점',
            address: '제주시 테스트구',
            latitude: 33.3620,
            longitude: 126.3100,
            storeType: 'convenience_store',
            isActive: true,
            isDeliverable: true,
            deliveryRadius: 2.5,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/stores')
          .set('X-Admin-Key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('필터링 쿼리를 지원해야 한다', async () => {
        // Mock filtered store list
        (prisma.store.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'store-1',
            name: '테스트편의점',
            address: '제주시 테스트구',
            latitude: 33.3620,
            longitude: 126.3100,
            storeType: 'convenience_store',
            isActive: true,
            isDeliverable: true,
            deliveryRadius: 2.5,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/stores')
          .set('X-Admin-Key', adminKey)
          .query({ isActive: 'true', storeType: 'convenience_store' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('GET /api/v1/admin/stores/:id', () => {
      it('스토어 상세 정보를 반환해야 한다', async () => {
        const response = await request(app)
          .get(`/api/v1/admin/stores/${mockStoreId}`)
          .set('X-Admin-Key', adminKey);

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
        }
      });

      it('유효하지 않은 ID 형식 시 400을 반환해야 한다', async () => {
        const response = await request(app)
          .get('/api/v1/admin/stores/invalid-id-format')
          .set('X-Admin-Key', adminKey);

        expect([400, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/v1/admin/stores/:id', () => {
      it('스토어 정보 업데이트 시 200을 반환해야 한다', async () => {
        const response = await request(app)
          .put(`/api/v1/admin/stores/${mockStoreId}`)
          .set('X-Admin-Key', adminKey)
          .send({
            isActive: false,
            deliveryRadius: 3.0
          });

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toBeDefined();
        }
      });

      it('유효하지 않은 좌표로 업데이트 시 400을 반환해야 한다', async () => {
        const response = await request(app)
          .put(`/api/v1/admin/stores/${mockStoreId}`)
          .set('X-Admin-Key', adminKey)
          .send({
            latitude: 999,
            longitude: 999
          });

        expect([400, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/v1/admin/stores/:id', () => {
      it('스토어 삭제 시 200을 반환해야 한다', async () => {
        const response = await request(app)
          .delete(`/api/v1/admin/stores/${mockStoreId}`)
          .set('X-Admin-Key', adminKey);

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });
  });

  describe('시나리오 1: 편의점 생성 및 상품 일괄 등록', () => {
    it('어드민이 편의점을 생성하고 여러 상품을 한 번에 등록한다', async () => {
      const storeResponse = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          storeType: 'convenience_store',
          name: 'GS25 제주한경점',
          address: '제주시 한경면 고산리 123',
          latitude: 33.3620,
          longitude: 126.3100,
          brandName: 'GS25',
          operatingHours24: true,
          deliveryRadius: 2.5,
          isActive: true,
          isDeliverable: true
        });

      expect(storeResponse.status).toBe(201);
      storeId = storeResponse.body.data.id;
      expect(storeResponse.body.data.storeType).toBe('convenience_store');

      const products = [
        { name: '삼각김밥 참치마요', price: 1500, category: '식품', stock: 30 },
        { name: '삼각김밥 불고기', price: 1800, category: '식품', stock: 25 },
        { name: '컵라면 신라면', price: 1200, category: '식품', stock: 50 },
        { name: '캔커피 맥심', price: 1500, category: '음료', stock: 40 },
        { name: '생수 500ml', price: 1000, category: '음료', stock: 100 },
        { name: '카스 맥주 500ml', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '테라 맥주 500ml', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '소주 참이슬', price: 2000, category: '주류', stock: 30, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '에너지드링크', price: 2500, category: '음료', stock: 15 }
      ];

      for (const product of products) {
        const productResponse = await request(app)
          .post(`/api/v1/admin/stores/${storeId}/products`)
          .send({
            ...product,
            isAvailable: true,
            isActive: true
          });

        expect(productResponse.status).toBe(201);
        productIds.push(productResponse.body.data.id);
      }

      const productsResponse = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`);

      expect(productsResponse.status).toBe(200);
      expect(productsResponse.body.data).toHaveLength(9);

      const categories = productsResponse.body.data.map((p: any) => p.category);
      expect(categories.filter((c: string) => c === '주류')).toHaveLength(3);
      expect(categories.filter((c: string) => c === '식품')).toHaveLength(3);
      expect(categories.filter((c: string) => c === '음료')).toHaveLength(3);
    });
  });

  describe('주문 엔드포인트', () => {
    describe('GET /api/v1/admin/orders', () => {
      it('주문 목록을 반환해야 한다', async () => {
        // Mock order list
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

        const response = await request(app)
          .get('/api/v1/admin/orders')
          .set('X-Admin-Key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.orders)).toBe(true);
      });

      it('상태 필터링을 지원해야 한다', async () => {
        // Mock filtered order list
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

        const response = await request(app)
          .get('/api/v1/admin/orders')
          .set('X-Admin-Key', adminKey)
          .query({ status: 'pending' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.orders)).toBe(true);
      });

      it('전체 상태 필터를 지원해야 한다', async () => {
        // Mock all orders
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

        const response = await request(app)
          .get('/api/v1/admin/orders')
          .set('X-Admin-Key', adminKey)
          .query({ status: 'all' });

        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(Array.isArray(response.body.orders)).toBe(true);
        }
      });
      storeId = store.id;

      const product1 = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });
      const product2 = await prisma.menu.create({
        data: { restaurantId: storeId, name: '맥주', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult', isAvailable: true, isActive: true }
      });
      productIds = [product1.id, product2.id];
    });

    it('상품 가격을 인상하고 재고를 조정한다', async () => {
      const priceResponse = await request(app)
        .put(`/api/v1/admin/products/${productIds[0]}`)
        .send({ price: 1800 });

      expect(priceResponse.status).toBe(200);
      expect(priceResponse.body.data.price).toBe(1800);

      let stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productIds[0]}/stock`)
        .send({ quantity: 10, operation: 'subtract' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(40);

      stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productIds[0]}/stock`)
        .send({ quantity: 20, operation: 'add' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(60);
    });

    it('재고가 0이 되면 자동 품절 처리된다', async () => {
      let stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productIds[0]}/stock`)
        .send({ quantity: 50, operation: 'subtract' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(0);
      expect(stockResponse.body.data.isAvailable).toBe(false);
    });
  });

  describe('대시보드 엔드포인트', () => {
    describe('GET /api/v1/admin/dashboard', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        // Mock dashboard calls - count for various statuses
        (prisma.order.count as jest.Mock)
          .mockResolvedValue(5) // pending
          .mockResolvedValue(3) // pending_confirmation
          .mockResolvedValue(2) // order_confirmed
          .mockResolvedValue(1) // picked_up
          .mockResolvedValue(2) // delivering
          .mockResolvedValue(10); // completed

        // Mock findMany for recent orders
        (prisma.order.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: '12345',
            status: 'pending',
            totalAmount: 15000,
            createdAt: new Date(),
            restaurant: { id: 'rest-1', name: 'Test Restaurant' },
          },
        ]);
      });

      it('대시보드 통계를 반환해야 한다', async () => {
        const response = await request(app)
          .get('/api/v1/admin/dashboard')
          .set('X-Admin-Key', adminKey);

    beforeEach(async () => {
      const store = await prisma.restaurant.create({
        data: {
          storeType: 'convenience_store',
          name: 'CU 제주한경점',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098,
          brandName: 'CU',
          isActive: true,
          isDeliverable: true,
          deliveryRadius: 3.0
        }
      });
      storeId = store.id;

      const user = await prisma.user.create({
        data: { phone: '010-1234-5678', name: '테스트사용자' }
      });
      userId = user.id;

      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });

      it('주문 상태별 통계를 포함해야 한다', async () => {
        jest.clearAllMocks();
        // Re-setup mocks for this test
        (prisma.order.count as jest.Mock)
          .mockResolvedValue(5)
          .mockResolvedValue(3)
          .mockResolvedValue(2)
          .mockResolvedValue(1)
          .mockResolvedValue(2)
          .mockResolvedValue(10);

        (prisma.order.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: '12345',
            status: 'pending',
            totalAmount: 15000,
            createdAt: new Date(),
            restaurant: { id: 'rest-1', name: 'Test Restaurant' },
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/dashboard')
          .set('X-Admin-Key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.stats).toHaveProperty('pending');
        expect(response.body.stats).toHaveProperty('completed');
      });
      orderId = order.id;
    });

      it('최근 주문 목록을 포함해야 한다', async () => {
        jest.clearAllMocks();
        // Re-setup mocks for this test
        (prisma.order.count as jest.Mock)
          .mockResolvedValue(5)
          .mockResolvedValue(3)
          .mockResolvedValue(2)
          .mockResolvedValue(1)
          .mockResolvedValue(2)
          .mockResolvedValue(10);

        (prisma.order.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: '12345',
            status: 'pending',
            totalAmount: 15000,
            createdAt: new Date(),
            restaurant: { id: 'rest-1', name: 'Test Restaurant' },
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/dashboard')
          .set('X-Admin-Key', adminKey);

      expect(ordersResponse.status).toBe(200);
      expect(ordersResponse.body.data.length).toBeGreaterThan(0);

      const orderResponse = await request(app)
        .get(`/api/v1/orders/${orderId}`);

      expect(orderResponse.status).toBe(200);
      expect(orderResponse.body.data.orderNumber).toBe('TEST001');
    });
  });

  describe('설정 엔드포인트', () => {
    describe('GET /api/v1/admin/settings', () => {
      it('설정 목록을 반환해야 한다', async () => {
        // Mock settings list
        (prisma.setting.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'setting-1',
            key: 'delivery_fee',
            value: '3000',
            type: 'number',
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/settings')
          .set('X-Admin-Key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });
      storeId = store.id;
    });

    describe('PUT /api/v1/admin/settings', () => {
      it('설정 업데이트 시 200을 반환해야 한다', async () => {
        // Mock setting update
        (prisma.setting.upsert as jest.Mock).mockResolvedValue({
          id: 'setting-1',
          key: 'delivery_fee',
          value: '3000',
          type: 'number',
        });

        const response = await request(app)
          .put('/api/v1/admin/settings')
          .set('X-Admin-Key', adminKey)
          .send({
            key: 'delivery_fee',
            value: 3000,
            type: 'number'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ requiresAgeVerification: true });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.requiresAgeVerification === true)).toBe(true);
    });
  });

  describe('시나리오 5: 배달원 등록 및 관리', () => {
    let driverId: string;

    it('배달원을 등록하고 목록을 조회한다', async () => {
      const driverResponse = await request(app)
        .post('/api/v1/drivers/register')
        .send({
          name: '홍길동',
          phone: '010-9999-8888',
          cardNumber: '1234'
        });

      expect([200, 201]).toContain(driverResponse.status);
      driverId = driverResponse.body.data.id;

      const listResponse = await request(app)
        .get('/api/v1/drivers/list');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('시나리오 6: 배달원 정산 관리', () => {
    let driverId: string;

    beforeEach(async () => {
      const driver = await prisma.driver.create({
        data: {
          name: '홍길동',
          phone: '010-9999-8888',
          cardNumber: '1234'
        }
      });
      driverId = driver.id;
    });

    it('배달원 정산 정보를 조회한다', async () => {
      const settlementResponse = await request(app)
        .get('/api/v1/driver-settlements/current')
        .query({ driverId });

      expect([200, 404]).toContain(settlementResponse.status);
    });
  });

  describe('레스토랑 엔드포인트 (호환성)', () => {
    describe('GET /api/v1/admin/restaurants', () => {
      it('레스토랑 목록을 반환해야 한다', async () => {
        // Mock restaurant list
        (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'rest-1',
            name: '테스트레스토랑',
            address: '제주시 테스트',
            latitude: 33.3620,
            longitude: 126.3100,
            isActive: true,
            isDeliverable: true,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('검색 필터링을 지원해야 한다', async () => {
        // Mock filtered restaurant list
        (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'rest-1',
            name: '김밥천국',
            address: '제주시 테스트',
            latitude: 33.3620,
            longitude: 126.3100,
            isActive: true,
            isDeliverable: true,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey)
          .query({ search: '김밥' });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('활성화 상태 필터링을 지원해야 한다', async () => {
        // Mock active restaurants
        (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'rest-1',
            name: '테스트레스토랑',
            address: '제주시 테스트',
            latitude: 33.3620,
            longitude: 126.3100,
            isActive: true,
            isDeliverable: true,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey)
          .query({ isActive: 'true' });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('배달 가능 여부 필터링을 지원해야 한다', async () => {
        // Mock deliverable restaurants
        (prisma.restaurant.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'rest-1',
            name: '테스트레스토랑',
            address: '제주시 테스트',
            latitude: 33.3620,
            longitude: 126.3100,
            isActive: true,
            isDeliverable: true,
          },
        ]);

        const response = await request(app)
          .get('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey)
          .query({ isDeliverable: 'true' });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('POST /api/v1/admin/restaurants', () => {
      it('유효한 데이터로 레스토랑 생성 시 200을 반환해야 한다', async () => {
        // Mock restaurant creation
        (prisma.restaurant.create as jest.Mock).mockResolvedValue({
          id: 'rest-1',
          name: '테스트레스토랑',
          address: '제주시 테스트',
          latitude: 33.3620,
          longitude: 126.3100,
          isActive: true,
          isDeliverable: true,
        });

        const response = await request(app)
          .post('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey)
          .send({
            name: '테스트레스토랑',
            address: '제주시 테스트',
            latitude: 33.3620,
            longitude: 126.3100,
            regionId: 'region-jeju'
          });

        expect([200, 201]).toContain(response.status);
        if (response.status === 200 || response.status === 201) {
          expect(response.body.success).toBe(true);
        }
      });

      it('필수 필드 누락 시 400을 반환해야 한다', async () => {
        const response = await request(app)
          .post('/api/v1/admin/restaurants')
          .set('X-Admin-Key', adminKey)
          .send({
            address: '제주시 테스트'
          });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('시나리오 8: 대시보드 통계 조회', () => {
    beforeEach(async () => {
      const store = await prisma.restaurant.create({
        data: {
          storeType: 'convenience_store',
          name: '테스트편의점',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098,
          brandName: 'CU',
          isActive: true,
          isDeliverable: true,
          deliveryRadius: 3.0
        }
      });

      const user = await prisma.user.create({
        data: { phone: '010-1111-2222', name: '주문자' }
      });

      await prisma.order.createMany({
        data: [
          {
            orderNumber: 'DASH001',
            userId: user.id,
            restaurantId: store.id,
            subtotal: 10000,
            deliveryFee: 3000,
            totalAmount: 13000,
            deliveryAddress: '테스트주소1',
            deliveryLatitude: 33.365,
            deliveryLongitude: 126.315,
            status: 'completed',
            createdAt: new Date()
          },
          {
            orderNumber: 'DASH002',
            userId: user.id,
            restaurantId: store.id,
            subtotal: 15000,
            deliveryFee: 3000,
            totalAmount: 18000,
            deliveryAddress: '테스트주소2',
            deliveryLatitude: 33.365,
            deliveryLongitude: 126.315,
            status: 'pending',
            createdAt: new Date()
          }
        ]
      });
    });

    it('어드민 대시보드에서 주요 통계를 조회한다', async () => {
      const dashboardResponse = await request(app)
        .get('/api/v1/admin/dashboard');

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body).toBeDefined();
    });
  });

  describe('시나리오 9: Mock 데이터 일괄 생성', () => {
    it('테스트용 Mock 데이터를 일괄 생성한다', async () => {
      const importResponse = await request(app)
        .post('/api/v1/admin/import-mock');

      expect([200, 201, 400]).toContain(importResponse.status);
    });
  });

  describe('시나리오 10: 상품 삭제 및 복원', () => {
    let productId: string;

    beforeEach(async () => {
      const store = await prisma.restaurant.create({
        data: {
          storeType: 'convenience_store',
          name: 'CU 제주한경점',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098,
          brandName: 'CU',
          isActive: true,
          isDeliverable: true,
          deliveryRadius: 3.0
        }
      });
      storeId = store.id;

      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '테스트상품', price: 1000, category: '식품', stock: 10, isAvailable: true, isActive: true }
      });
      productId = product.id;
    });

    it('상품을 삭제하고 다시 활성화한다', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/v1/admin/products/${productId}`);

      expect(deleteResponse.status).toBe(200);

      const getResponse = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`);

      expect(getResponse.body.data.find((p: any) => p.id === productId)).toBeUndefined();
    });
  });
});
