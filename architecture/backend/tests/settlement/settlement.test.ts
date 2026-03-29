import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import app from '../../src/app';

const prisma = new PrismaClient();

describe('정산 시스템 API 테스트', () => {
  let testDriverId: string;
  let testUserId: string;
  let testRestaurantId: string;
  let testOrderId: string;
  let testSettlementId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 테스트 데이터 초기화
    await prisma.settlementItem.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.user.deleteMany();

    // 테스트 데이터 생성
    const driver = await prisma.driver.create({
      data: {
        phone: '010-1111-1111',
        name: '김배달',
        isOnDuty: true,
        bankName: '국민은행',
        bankAccount: '123-456-789',
        accountHolder: '김배달'
      }
    });
    testDriverId = driver.id;

    const user = await prisma.user.create({
      data: {
        phone: '010-9999-1111',
        name: '김고객'
      }
    });
    testUserId = user.id;

    const restaurant = await prisma.restaurant.create({
      data: {
        name: '테스트 식당',
        address: '제주시 한경면',
        latitude: 33.3615,
        longitude: 126.3098
      }
    });
    testRestaurantId = restaurant.id;
  });

  describe('TC-SET-001: 월 정산 정상 생성', () => {
    beforeEach(async () => {
      // 배달 완료 주문 150건 생성
      for (let i = 0; i < 150; i++) {
        await prisma.order.create({
          data: {
            orderNumber: `ORD202603${String(i + 1).padStart(6, '0')}`,
            userId: testUserId,
            restaurantId: testRestaurantId,
            driverId: testDriverId,
            status: 'completed',
            subtotal: 10000,
            deliveryFee: 3000,
            totalAmount: 13000,
            deliveryAddress: '제주시 한경면 신도리 123',
            deliveryLatitude: 33.365,
            deliveryLongitude: 126.315,
            deliveredAt: new Date('2026-03-15T12:00:00Z'),
            paymentStatus: 'paid'
          }
        });
      }
    });

    it('POST /api/v1/settlements/generate - 정산 생성 성공', async () => {
      const response = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      console.log('Response:', response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generated).toBe(1);
      expect(response.body.data.settlements).toHaveLength(1);

      const settlement = response.body.data.settlements[0];
      expect(settlement.driverId).toBe(testDriverId);
      expect(settlement.totalDeliveries).toBe(150);
      expect(settlement.totalDeliveryFee).toBe(450000);
      expect(settlement.serviceFee).toBe(45000); // 10%
      expect(settlement.tax).toBe(13365); // (450000 - 45000) * 0.033
      expect(settlement.netAmount).toBe(391635);
      expect(settlement.status).toBe('calculated');

      testSettlementId = settlement.id;
    });
  });

  describe('TC-SET-004: 중복 정산 생성 방지', () => {
    beforeEach(async () => {
      // 정산 1건 생성
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });
    });

    it('동일 기간 중복 생성 시 기존 유지', async () => {
      const response = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      // 중복 생성이 아닌 기존 유지 처리
      expect(response.status).toBe(200);
      expect(response.body.data.generated).toBe(0);
    });
  });

  describe('TC-SET-005: 잘못된 기간 형식', () => {
    it('잘못된 월 형식 - 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-13' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('기간');
    });

    it('잘못된 형식 - 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '202603' });

      expect(response.status).toBe(400);
    });

    it('빈 값 - 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('TC-SET-010: 정산 승인', () => {
    beforeEach(async () => {
      // 정산 생성
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      const generateRes = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      testSettlementId = generateRes.body.data.settlements[0].id;
    });

    it('정산 승인 성공', async () => {
      const response = await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/approve`)
        .send({ notes: '이상 없음 확인' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
      expect(response.body.data.approvedAt).toBeDefined();
    });
  });

  describe('TC-SET-011: 이미 승인된 정산 재승인', () => {
    beforeEach(async () => {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      const generateRes = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      testSettlementId = generateRes.body.data.settlements[0].id;

      // 승인 처리
      await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/approve`)
        .send({ notes: '이상 없음 확인' });
    });

    it('이미 승인된 정산 재승인 시 에러', async () => {
      const response = await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/approve`)
        .send({ notes: '재승인 시도' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('승인');
    });
  });

  describe('TC-SET-013: 정산 지급 처리', () => {
    beforeEach(async () => {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      const generateRes = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      testSettlementId = generateRes.body.data.settlements[0].id;

      // 승인 처리
      await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/approve`)
        .send({ notes: '이상 없음 확인' });
    });

    it('지급 완료 처리 성공', async () => {
      const response = await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/pay`)
        .send({
          paidAmount: 391635,
          paidAt: '2026-03-28',
          notes: '이체 완료'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('paid');
      expect(response.body.data.paidAmount).toBe(391635);
    });
  });

  describe('TC-SET-014: 미승인 정산 지급 시도', () => {
    beforeEach(async () => {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      const generateRes = await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });

      testSettlementId = generateRes.body.data.settlements[0].id;
    });

    it('미승인 정산 지급 시 에러', async () => {
      const response = await request(app)
        .put(`/api/v1/settlements/${testSettlementId}/pay`)
        .send({
          paidAmount: 391635,
          paidAt: '2026-03-28'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('승인');
    });
  });

  describe('TC-SET-016: 정산 목록 조회', () => {
    beforeEach(async () => {
      // 여러 배달원, 여러 월 정산 생성
      const driver2 = await prisma.driver.create({
        data: {
          phone: '010-2222-2222',
          name: '이배달'
        }
      });

      // 2026-03 주문
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000002',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: driver2.id,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3500,
          totalAmount: 13500,
          deliveryAddress: '제주시 한경면 판포리 456',
          deliveryLatitude: 33.37,
          deliveryLongitude: 126.32,
          deliveredAt: new Date('2026-03-16T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      // 정산 생성
      await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });
    });

    it('전체 정산 목록 조회 성공', async () => {
      const response = await request(app)
        .get('/api/v1/settlements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.settlements).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
    });

    it('기간 필터링 조회', async () => {
      const response = await request(app)
        .get('/api/v1/settlements?period=2026-03');

      expect(response.status).toBe(200);
      expect(response.body.data.settlements.every((s: any) => s.period === '2026-03')).toBe(true);
    });

    it('상태 필터링 조회', async () => {
      const response = await request(app)
        .get('/api/v1/settlements?status=calculated');

      expect(response.status).toBe(200);
      expect(response.body.data.settlements.every((s: any) => s.status === 'calculated')).toBe(true);
    });
  });

  describe('TC-SET-019: 배달원별 정산 조회', () => {
    beforeEach(async () => {
      await prisma.order.create({
        data: {
          orderNumber: 'ORD202603000001',
          userId: testUserId,
          restaurantId: testRestaurantId,
          driverId: testDriverId,
          status: 'completed',
          subtotal: 10000,
          deliveryFee: 3000,
          totalAmount: 13000,
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          deliveredAt: new Date('2026-03-15T12:00:00Z'),
          paymentStatus: 'paid'
        }
      });

      await request(app)
        .post('/api/v1/settlements/generate')
        .send({ period: '2026-03' });
    });

    it('배달원 본인 정산 조회 성공', async () => {
      const response = await request(app)
        .get(`/api/v1/drivers/${testDriverId}/settlements`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.driver.id).toBe(testDriverId);
      expect(response.body.data.settlements).toHaveLength(1);
    });
  });

  describe('TC-SET-020: 이번 달 예상 정산', () => {
    beforeEach(async () => {
      // 이번 달 배달 완료 주문 생성
      const now = new Date();
      for (let i = 0; i < 85; i++) {
        await prisma.order.create({
          data: {
            orderNumber: `ORD${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(i + 1).padStart(6, '0')}`,
            userId: testUserId,
            restaurantId: testRestaurantId,
            driverId: testDriverId,
            status: 'completed',
            subtotal: 10000,
            deliveryFee: 3000,
            totalAmount: 13000,
            deliveryAddress: '제주시 한경면 신도리 123',
            deliveryLatitude: 33.365,
            deliveryLongitude: 126.315,
            deliveredAt: now,
            paymentStatus: 'paid'
          }
        });
      }
    });

    it('이번 달 예상 정산 조회 성공', async () => {
      const response = await request(app)
        .get(`/api/v1/drivers/${testDriverId}/settlements/current`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalDeliveries).toBe(85);
      expect(response.body.data.totalDeliveryFee).toBe(255000);
      expect(response.body.data.estimatedNetAmount).toBeGreaterThan(0);
    });
  });

  describe('TC-SET-021: 존재하지 않는 정산 조회', () => {
    it('존재하지 않는 정산 ID - 404 에러', async () => {
      const response = await request(app)
        .get('/api/v1/settlements/non-existent-id');

      expect(response.status).toBe(404);
    });
  });
});
