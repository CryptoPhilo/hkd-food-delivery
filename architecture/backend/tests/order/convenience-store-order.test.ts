import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Convenience Store Order Flow', () => {
  let userId: string;
  let userToken: string;
  let storeId: string;
  let normalProductId: string;
  let adultProductId: string;
  let teenProductId: string;

  beforeEach(async () => {
    await prisma.ageVerification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.user.deleteMany();
    await prisma.setting.deleteMany();

    const verifyRes = await request(app)
      .post('/api/v1/auth/phone/request')
      .send({ phone: '010-1234-5678' });

    const setting = await prisma.setting.findUnique({
      where: { key: 'verify_010-1234-5678' }
    });
    const code = setting!.value;

    const authRes = await request(app)
      .post('/api/v1/auth/phone/verify')
      .send({ phone: '010-1234-5678', code });

    userToken = authRes.body.access_token;
    userId = authRes.body.user.id;

    const store = await prisma.restaurant.create({
      data: {
        storeType: 'convenience_store',
        name: 'CU 한경면점',
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

    const normalProduct = await prisma.menu.create({
      data: {
        restaurantId: storeId,
        name: '삼각김밥',
        price: 1500,
        category: '식품',
        stock: 50,
        isAvailable: true,
        isActive: true
      }
    });
    normalProductId = normalProduct.id;

    const adultProduct = await prisma.menu.create({
      data: {
        restaurantId: storeId,
        name: '카스 맥주',
        price: 3500,
        category: '음료',
        stock: 100,
        requiresAgeVerification: true,
        ageRestriction: 'adult',
        isAvailable: true,
        isActive: true
      }
    });
    adultProductId = adultProduct.id;

    const teenProduct = await prisma.menu.create({
      data: {
        restaurantId: storeId,
        name: '에너지 드링크',
        price: 2500,
        category: '음료',
        stock: 30,
        requiresAgeVerification: true,
        ageRestriction: 'teen',
        isAvailable: true,
        isActive: true
      }
    });
    teenProductId = teenProduct.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('일반 상품 주문', () => {
    it('일반 상품 주문 성공 (성인 인증 불필요)', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: normalProductId, quantity: 2 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subtotal).toBe(3000);
    });

    it('일반 상품 여러 개 주문', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [
            { menuId: normalProductId, quantity: 2 },
            { menuId: normalProductId, quantity: 1 }
          ],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(201);
      expect(response.body.data.subtotal).toBe(4500);
    });
  });

  describe('성인 인증 필요 상품 주문', () => {
    it('인증 없이 성인 상품 주문 시 403 에러', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: adultProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('성인 인증');
    });

    it('유효한 성인 인증 후 주문 성공', async () => {
      const verification = await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: adultProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315,
          ageVerificationId: verification.id
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('만료된 성인 인증으로 주문 시 403 에러', async () => {
      const verification = await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() - 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: adultProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315,
          ageVerificationId: verification.id
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('청소년 인증 필요 상품 주문', () => {
    it('인증 없이 청소년 상품 주문 시 403 에러', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: teenProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('성인 인증');
    });

    it('유효한 인증 후 청소년 상품 주문 성공', async () => {
      const verification = await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: teenProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315,
          ageVerificationId: verification.id
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('혼합 주문 (일반 + 성인 인증 필요)', () => {
    it('인증 없이 혼합 주문 시 403 에러', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [
            { menuId: normalProductId, quantity: 2 },
            { menuId: adultProductId, quantity: 1 }
          ],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(403);
    });

    it('인증 후 혼합 주문 성공', async () => {
      const verification = await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 3600000),
          method: 'phone',
          phoneNumber: '010-1234-5678',
          isVerified: true
        }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [
            { menuId: normalProductId, quantity: 2 },
            { menuId: adultProductId, quantity: 1 }
          ],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315,
          ageVerificationId: verification.id
        });

      expect(response.status).toBe(201);
      expect(response.body.data.subtotal).toBe(6500);
    });
  });

  describe('재고 관리', () => {
    it('재고 부족 시 주문 실패', async () => {
      await prisma.menu.update({
        where: { id: normalProductId },
        data: { stock: 1 }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: normalProductId, quantity: 5 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('재고');
    });

    it('품절 상품 주문 실패', async () => {
      await prisma.menu.update({
        where: { id: normalProductId },
        data: { isAvailable: false }
      });

      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: normalProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('품절');
    });
  });

  describe('배달 가능 지역', () => {
    it('배달 가능 지역 내 주문 성공', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: normalProductId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(201);
    });

    it('배달 불가 지역 주문 시 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: normalProductId, quantity: 1 }],
          deliveryAddress: '서울시 강남구',
          deliveryLat: 37.5,
          deliveryLng: 127.0
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('배달');
    });
  });

  describe('주류/음식 비율 검증', () => {
    let foodProductId: string;
    let alcoholProductId: string;

    beforeEach(async () => {
      const foodProduct = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '김치찌개',
          price: 8000,
          category: '식사',
          stock: 50,
          isAvailable: true,
          isActive: true
        }
      });
      foodProductId = foodProduct.id;

      const alcoholProduct = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '소주',
          price: 4000,
          category: '주류',
          stock: 100,
          requiresAgeVerification: true,
          ageRestriction: 'adult',
          isAvailable: true,
          isActive: true
        }
      });
      alcoholProductId = alcoholProduct.id;
    });

    it('주류 금액이 음식 금액보다 적을 때 검증 통과', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 2 },
            { menuId: alcoholProductId, quantity: 1 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.foodAmount).toBe(16000);
      expect(response.body.data.alcoholAmount).toBe(4000);
      expect(response.body.data.hasAlcoholViolation).toBe(false);
      expect(response.body.data.warning).toBeNull();
    });

    it('주류 금액이 음식 금액보다 클 때 검증 실패', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 1 },
            { menuId: alcoholProductId, quantity: 3 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.foodAmount).toBe(8000);
      expect(response.body.data.alcoholAmount).toBe(12000);
      expect(response.body.data.hasAlcoholViolation).toBe(true);
      expect(response.body.data.warning).toContain('주류 구매 총액은 음식 구매액보다 적어야 합니다');
    });

    it('주류만 주문할 때 검증 통과', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: alcoholProductId, quantity: 2 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.foodAmount).toBe(0);
      expect(response.body.data.alcoholAmount).toBe(8000);
      expect(response.body.data.hasAlcoholViolation).toBe(false);
    });

    it('음식만 주문할 때 검증 통과', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 2 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.foodAmount).toBe(16000);
      expect(response.body.data.alcoholAmount).toBe(0);
      expect(response.body.data.hasAlcoholViolation).toBe(false);
    });

    it('주류와 음식 금액이 같을 때 검증 통과', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 1 },
            { menuId: alcoholProductId, quantity: 2 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.foodAmount).toBe(8000);
      expect(response.body.data.alcoholAmount).toBe(8000);
      expect(response.body.data.hasAlcoholViolation).toBe(false);
    });

    it('성인 인증 필요 여부 확인', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: alcoholProductId, quantity: 1 }
          ]
        });

      expect(response.body.data.needsAgeVerification).toBe(true);
    });

    it('주류가 아닌 경우 성인 인증 불필요', async () => {
      const response = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 1 }
          ]
        });

      expect(response.body.data.needsAgeVerification).toBe(false);
    });
  });
});
