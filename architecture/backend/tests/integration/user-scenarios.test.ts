import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('사용자 시나리오 통합 테스트', () => {
  beforeEach(async () => {
    await prisma.ageVerification.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menu.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.user.deleteMany();
    await prisma.setting.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('시나리오 1: 편의점 생성 및 상품 등록 (어드민)', () => {
    it('어드민이 편의점을 생성하고 상품을 등록한다', async () => {
      const storeResponse = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          storeType: 'convenience_store',
          name: 'GS25 한경면점',
          address: '제주시 한경면 고산리 456',
          latitude: 33.3620,
          longitude: 126.3100,
          brandName: 'GS25',
          operatingHours24: true,
          deliveryRadius: 2.5,
          isActive: true,
          isDeliverable: true
        });

      expect(storeResponse.status).toBe(201);
      expect(storeResponse.body.data.storeType).toBe('convenience_store');
      const storeId = storeResponse.body.data.id;

      const products = [
        { name: '삼각김밥 참치마요', price: 1500, category: '식품', stock: 30 },
        { name: '삼각김밥 불고기', price: 1800, category: '식품', stock: 25 },
        { name: '컵라면 신라면', price: 1200, category: '식품', stock: 50 },
        { name: '캔커피 맥심', price: 1500, category: '음료', stock: 40 },
        { name: '생수 500ml', price: 1000, category: '음료', stock: 100 },
        { name: '카스 맥주 500ml', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '테라 맥주 500ml', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '소주 참이슬', price: 2000, category: '주류', stock: 30, requiresAgeVerification: true, ageRestriction: 'adult' },
        { name: '에너지드링크', price: 2500, category: '음료', stock: 15, requiresAgeVerification: true, ageRestriction: 'teen' }
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
      }

      const productsResponse = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`);

      expect(productsResponse.status).toBe(200);
      expect(productsResponse.body.data).toHaveLength(9);
    });
  });

  describe('시나리오 2: 일반 사용자 회원가입 및 편의점 상품 주문', () => {
    let storeId: string;
    let userId: string;
    let userToken: string;
    let productIds: string[] = [];

    beforeEach(async () => {
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

      const products = await Promise.all([
        prisma.menu.create({
          data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
        }),
        prisma.menu.create({
          data: { restaurantId: storeId, name: '컵라면', price: 1200, category: '식품', stock: 30, isAvailable: true, isActive: true }
        }),
        prisma.menu.create({
          data: { restaurantId: storeId, name: '캔커피', price: 1500, category: '음료', stock: 40, isAvailable: true, isActive: true }
        })
      ]);
      productIds = products.map(p => p.id);
    });

    it('전화번호 인증으로 회원가입하고 일반 상품을 주문한다', async () => {
      await request(app)
        .post('/api/v1/auth/phone/request')
        .send({ phone: '010-9999-1111' });

      const setting = await prisma.setting.findUnique({
        where: { key: 'verify_010-9999-1111' }
      });
      const code = setting!.value;

      const authResponse = await request(app)
        .post('/api/v1/auth/phone/verify')
        .send({ phone: '010-9999-1111', code });

      expect(authResponse.status).toBe(200);
      expect(authResponse.body.access_token).toBeDefined();
      userId = authResponse.body.user.id;
      userToken = authResponse.body.access_token;

      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [
            { menuId: productIds[0], quantity: 2 },
            { menuId: productIds[1], quantity: 1 },
            { menuId: productIds[2], quantity: 1 }
          ],
          deliveryAddress: '제주시 한경면 신도리 789',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.data.subtotal).toBe(5700);
      expect(orderResponse.body.data.items).toHaveLength(3);
    });
  });

  describe('시나리오 3: 성인 인증 후 주류 상품 주문', () => {
    let storeId: string;
    let userId: string;
    let userToken: string;
    let foodProductId: string;
    let alcoholProductId: string;

    beforeEach(async () => {
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

      const food = await prisma.menu.create({
        data: { restaurantId: storeId, name: '김치찌개', price: 8000, category: '식사', stock: 50, isAvailable: true, isActive: true }
      });
      foodProductId = food.id;

      const alcohol = await prisma.menu.create({
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
      alcoholProductId = alcohol.id;

      await request(app)
        .post('/api/v1/auth/phone/request')
        .send({ phone: '010-8888-2222' });

      const setting = await prisma.setting.findUnique({
        where: { key: 'verify_010-8888-2222' }
      });
      const code = setting!.value;

      const authResponse = await request(app)
        .post('/api/v1/auth/phone/verify')
        .send({ phone: '010-8888-2222', code });

      userId = authResponse.body.user.id;
      userToken = authResponse.body.access_token;
    });

    it('성인 인증 후 주류를 포함한 주문을 성공한다', async () => {
      const verification = await prisma.ageVerification.create({
        data: {
          userId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          method: 'phone',
          phoneNumber: '010-8888-2222',
          isVerified: true
        }
      });

      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [
            { menuId: foodProductId, quantity: 2 },
            { menuId: alcoholProductId, quantity: 1 }
          ],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315,
          ageVerificationId: verification.id
        });

      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.data.subtotal).toBe(20000);
    });
  });

  describe('시나리오 4: 주류/음식 비율 검증 (경고 팝업 시나리오)', () => {
    let storeId: string;
    let foodProductId: string;
    let alcoholProductId: string;

    beforeEach(async () => {
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

      const food = await prisma.menu.create({
        data: { restaurantId: storeId, name: '김치찌개', price: 8000, category: '식사', stock: 50, isAvailable: true, isActive: true }
      });
      foodProductId = food.id;

      const alcohol = await prisma.menu.create({
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
      alcoholProductId = alcohol.id;
    });

    it('주류 금액이 음식 금액보다 클 때 경고 메시지를 반환한다', async () => {
      const validateResponse = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 1 },
            { menuId: alcoholProductId, quantity: 3 }
          ]
        });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.data.isValid).toBe(false);
      expect(validateResponse.body.data.hasAlcoholViolation).toBe(true);
      expect(validateResponse.body.data.foodAmount).toBe(8000);
      expect(validateResponse.body.data.alcoholAmount).toBe(12000);
      expect(validateResponse.body.data.warning).toContain('주류 구매 총액은 음식 구매액보다 적어야 합니다');
    });

    it('주류 금액이 음식 금액보다 적을 때 주문을 진행할 수 있다', async () => {
      const validateResponse = await request(app)
        .post('/api/v1/orders/validate')
        .send({
          items: [
            { menuId: foodProductId, quantity: 2 },
            { menuId: alcoholProductId, quantity: 1 }
          ]
        });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.data.isValid).toBe(true);
      expect(validateResponse.body.data.hasAlcoholViolation).toBe(false);
      expect(validateResponse.body.data.foodAmount).toBe(16000);
      expect(validateResponse.body.data.alcoholAmount).toBe(4000);
      expect(validateResponse.body.data.warning).toBeNull();
    });
  });

  describe('시나리오 5: 재고 관리 및 품절 처리', () => {
    let storeId: string;
    let productId: string;

    beforeEach(async () => {
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

      const product = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '한정판 과자',
          price: 3000,
          category: '식품',
          stock: 5,
          isAvailable: true,
          isActive: true
        }
      });
      productId = product.id;
    });

    it('재고를 감소시키고 0이 되면 품절 처리한다', async () => {
      let stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({ quantity: 3, operation: 'subtract' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(2);

      stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({ quantity: 2, operation: 'subtract' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(0);
      expect(stockResponse.body.data.isAvailable).toBe(false);
    });

    it('재고를 추가하여 다시 판매 가능하게 한다', async () => {
      await prisma.menu.update({
        where: { id: productId },
        data: { stock: 0, isAvailable: false }
      });

      const stockResponse = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({ quantity: 10, operation: 'add' });

      expect(stockResponse.status).toBe(200);
      expect(stockResponse.body.data.stock).toBe(10);
    });
  });

  describe('시나리오 6: 카테고리별 상품 조회', () => {
    let storeId: string;

    beforeEach(async () => {
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

      await prisma.menu.createMany({
        data: [
          { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true },
          { restaurantId: storeId, name: '컵라면', price: 1200, category: '식품', stock: 30, isAvailable: true, isActive: true },
          { restaurantId: storeId, name: '캔커피', price: 1500, category: '음료', stock: 40, isAvailable: true, isActive: true },
          { restaurantId: storeId, name: '생수', price: 1000, category: '음료', stock: 100, isAvailable: true, isActive: true },
          { restaurantId: storeId, name: '소주', price: 2000, category: '주류', stock: 30, requiresAgeVerification: true, ageRestriction: 'adult', isAvailable: true, isActive: true },
          { restaurantId: storeId, name: '맥주', price: 3500, category: '주류', stock: 20, requiresAgeVerification: true, ageRestriction: 'adult', isAvailable: true, isActive: true }
        ]
      });
    });

    it('주류 카테고리만 조회한다', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ category: '주류' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.category === '주류')).toBe(true);
    });

    it('성인 인증이 필요한 상품만 조회한다', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ requiresAgeVerification: true });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.requiresAgeVerification === true)).toBe(true);
    });
  });

  describe('시나리오 7: 배달 가능 지역 검증', () => {
    let storeId: string;
    let productId: string;
    let userId: string;

    beforeEach(async () => {
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
          deliveryRadius: 2.0
        }
      });
      storeId = store.id;

      const product = await prisma.menu.create({
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
      productId = product.id;

      await request(app)
        .post('/api/v1/auth/phone/request')
        .send({ phone: '010-7777-3333' });

      const setting = await prisma.setting.findUnique({
        where: { key: 'verify_010-7777-3333' }
      });
      const code = setting!.value;

      const authResponse = await request(app)
        .post('/api/v1/auth/phone/verify')
        .send({ phone: '010-7777-3333', code });

      userId = authResponse.body.user.id;
    });

    it('배달 가능 지역 내에서는 주문이 성공한다', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: productId, quantity: 1 }],
          deliveryAddress: '제주시 한경면 신도리 123',
          deliveryLat: 33.365,
          deliveryLng: 126.315
        });

      expect(response.status).toBe(201);
    });

    it('배달 가능 지역 밖에서는 주문이 실패한다', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .send({
          userId,
          restaurantId: storeId,
          items: [{ menuId: productId, quantity: 1 }],
          deliveryAddress: '서울시 강남구',
          deliveryLat: 37.5,
          deliveryLng: 127.0
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('배달 가능 지역');
    });
  });

  describe('시나리오 8: 편의점 정보 수정 및 삭제', () => {
    it('편의점 정보를 수정하고 삭제한다', async () => {
      const createResponse = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          storeType: 'convenience_store',
          name: '세븐일레븐 한경면점',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098,
          brandName: '세븐일레븐',
          isActive: true,
          isDeliverable: true
        });

      expect(createResponse.status).toBe(201);
      const storeId = createResponse.body.data.id;

      const updateResponse = await request(app)
        .put(`/api/v1/admin/stores/${storeId}`)
        .send({
          name: '세븐일레븐 한경면점 (리뉴얼)',
          operatingHours24: true,
          deliveryRadius: 3.5
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.name).toBe('세븐일레븐 한경면점 (리뉴얼)');
      expect(updateResponse.body.data.operatingHours24).toBe(true);

      const deleteResponse = await request(app)
        .delete(`/api/v1/admin/stores/${storeId}`);

      expect(deleteResponse.status).toBe(200);

      const getResponse = await request(app)
        .get(`/api/v1/admin/stores/${storeId}`);

      expect(getResponse.status).toBe(404);
    });
  });
});
