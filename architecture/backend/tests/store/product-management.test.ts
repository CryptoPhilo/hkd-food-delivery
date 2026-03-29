import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Admin Product Management API', () => {
  let storeId: string;

  beforeEach(async () => {
    await prisma.menu.deleteMany();
    await prisma.order.deleteMany();
    await prisma.restaurant.deleteMany();

    const store = await prisma.restaurant.create({
      data: {
        storeType: 'convenience_store',
        name: 'CU 한경면점',
        address: '제주시 한경면',
        latitude: 33.3615,
        longitude: 126.3098,
        brandName: 'CU',
        isActive: true,
        isDeliverable: true
      }
    });
    storeId = store.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/admin/stores/:storeId/products', () => {
    it('일반 상품 등록 성공', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '삼각김밥',
          description: '참치마요 삼각김밥',
          price: 1500,
          category: '식품',
          stock: 50,
          requiresAgeVerification: false,
          ageRestriction: 'none',
          isAvailable: true,
          isActive: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('삼각김밥');
      expect(response.body.data.price).toBe(1500);
      expect(response.body.data.requiresAgeVerification).toBe(false);
      expect(response.body.data.ageRestriction).toBe('none');
    });

    it('주류 상품 등록 성공 (성인 인증 필요)', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '카스 맥주',
          description: '500ml 캔',
          price: 3500,
          category: '음료',
          stock: 100,
          requiresAgeVerification: true,
          ageRestriction: 'adult',
          isAvailable: true,
          isActive: true
        });

      expect(response.status).toBe(201);
      expect(response.body.data.requiresAgeVerification).toBe(true);
      expect(response.body.data.ageRestriction).toBe('adult');
    });

    it('청소년 이용불가 상품 등록 성공', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '에너지 드링크',
          description: '고카페인 음료',
          price: 2500,
          category: '음료',
          stock: 30,
          requiresAgeVerification: true,
          ageRestriction: 'teen',
          isAvailable: true,
          isActive: true
        });

      expect(response.status).toBe(201);
      expect(response.body.data.ageRestriction).toBe('teen');
    });

    it('바코드 포함 상품 등록', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '코카콜라',
          price: 2000,
          category: '음료',
          barcode: '8801094011116',
          stock: 200
        });

      expect(response.status).toBe(201);
      expect(response.body.data.barcode).toBe('8801094011116');
    });

    it('존재하지 않는 편의점에 상품 등록 시 404', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores/non-existent-id/products')
        .send({
          name: '테스트 상품',
          price: 1000
        });

      expect(response.status).toBe(404);
    });

    it('필수 필드 누락 시 400 에러', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          description: '이름과 가격이 없는 상품'
        });

      expect(response.status).toBe(400);
    });

    it('음수 가격으로 등록 시 400 에러', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '잘못된 가격',
          price: -1000
        });

      expect(response.status).toBe(400);
    });

    it('음수 재고로 등록 시 400 에러', async () => {
      const response = await request(app)
        .post(`/api/v1/admin/stores/${storeId}/products`)
        .send({
          name: '잘못된 재고',
          price: 1000,
          stock: -10
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/admin/stores/:storeId/products', () => {
    beforeEach(async () => {
      await prisma.menu.createMany({
        data: [
          {
            restaurantId: storeId,
            name: '삼각김밥',
            price: 1500,
            category: '식품',
            stock: 50,
            isAvailable: true,
            isActive: true
          },
          {
            restaurantId: storeId,
            name: '카스 맥주',
            price: 3500,
            category: '음료',
            stock: 100,
            requiresAgeVerification: true,
            ageRestriction: 'adult',
            isAvailable: true,
            isActive: true
          },
          {
            restaurantId: storeId,
            name: '에너지 드링크',
            price: 2500,
            category: '음료',
            stock: 30,
            requiresAgeVerification: true,
            ageRestriction: 'teen',
            isAvailable: true,
            isActive: true
          },
          {
            restaurantId: storeId,
            name: '품절 상품',
            price: 1000,
            category: '식품',
            stock: 0,
            isAvailable: false,
            isActive: true
          }
        ]
      });
    });

    it('전체 상품 조회', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
    });

    it('카테고리별 필터링', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ category: '음료' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.category === '음료')).toBe(true);
    });

    it('성인 인증 필요 상품만 필터링', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ requiresAgeVerification: true });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((p: any) => p.requiresAgeVerification === true)).toBe(true);
    });

    it('사용 가능한 상품만 필터링', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}/products`)
        .query({ availableOnly: true });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every((p: any) => p.isAvailable === true)).toBe(true);
    });
  });

  describe('PUT /api/v1/admin/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '수정 전 상품',
          price: 1000,
          category: '식품',
          stock: 10,
          isAvailable: true,
          isActive: true
        }
      });
      productId = product.id;
    });

    it('상품 정보 수정 성공', async () => {
      const response = await request(app)
        .put(`/api/v1/admin/products/${productId}`)
        .send({
          name: '수정된 상품',
          price: 2000,
          stock: 20
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('수정된 상품');
      expect(response.body.data.price).toBe(2000);
      expect(response.body.data.stock).toBe(20);
    });

    it('성인 인증 설정 추가', async () => {
      const response = await request(app)
        .put(`/api/v1/admin/products/${productId}`)
        .send({
          requiresAgeVerification: true,
          ageRestriction: 'adult'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.requiresAgeVerification).toBe(true);
      expect(response.body.data.ageRestriction).toBe('adult');
    });

    it('존재하지 않는 상품 수정 시 404', async () => {
      const response = await request(app)
        .put('/api/v1/admin/products/non-existent-id')
        .send({ name: '수정' });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/admin/products/:id/stock', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '재고 테스트 상품',
          price: 1000,
          stock: 50,
          isAvailable: true,
          isActive: true
        }
      });
      productId = product.id;
    });

    it('재고 증가', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({
          quantity: 30,
          operation: 'add'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stock).toBe(80);
    });

    it('재고 감소', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({
          quantity: 20,
          operation: 'subtract'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stock).toBe(30);
    });

    it('재고 설정', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({
          quantity: 100,
          operation: 'set'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stock).toBe(100);
    });

    it('재고를 0으로 설정하면 품절 처리', async () => {
      const response = await request(app)
        .patch(`/api/v1/admin/products/${productId}/stock`)
        .send({
          quantity: 0,
          operation: 'set'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.stock).toBe(0);
      expect(response.body.data.isAvailable).toBe(false);
    });
  });

  describe('DELETE /api/v1/admin/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: {
          restaurantId: storeId,
          name: '삭제될 상품',
          price: 1000,
          isAvailable: true,
          isActive: true
        }
      });
      productId = product.id;
    });

    it('상품 삭제 성공', async () => {
      const response = await request(app)
        .delete(`/api/v1/admin/products/${productId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deleted = await prisma.menu.findUnique({
        where: { id: productId }
      });
      expect(deleted).toBeNull();
    });

    it('존재하지 않는 상품 삭제 시 404', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/products/non-existent-id');

      expect(response.status).toBe(404);
    });
  });
});
