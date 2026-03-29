import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Admin Store Management API', () => {
  beforeEach(async () => {
    await prisma.menu.deleteMany();
    await prisma.order.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.setting.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/admin/stores', () => {
    it('편의점 생성 성공', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          storeType: 'convenience_store',
          name: 'CU 한경면점',
          address: '제주시 한경면 고산리 123',
          roadAddress: '제주시 한경면 한경로 123',
          latitude: 33.3615,
          longitude: 126.3098,
          phone: '064-123-4567',
          brandName: 'CU',
          operatingHours24: true,
          deliveryRadius: 2.0,
          isActive: true,
          isDeliverable: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.storeType).toBe('convenience_store');
      expect(response.body.data.name).toBe('CU 한경면점');
      expect(response.body.data.brandName).toBe('CU');
      expect(response.body.data.operatingHours24).toBe(true);
    });

    it('식당 생성 성공 (기존 호환성)', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          storeType: 'restaurant',
          name: '테스트 식당',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.storeType).toBe('restaurant');
    });

    it('storeType 없이 생성 시 기본값 restaurant 적용', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          name: '기본 식당',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098
        });

      expect(response.status).toBe(201);
      expect(response.body.data.storeType).toBe('restaurant');
    });

    it('필수 필드 누락 시 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          name: '이름만 있는 가게'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('필수');
    });

    it('잘못된 좌표로 생성 시 400 에러', async () => {
      const response = await request(app)
        .post('/api/v1/admin/stores')
        .send({
          name: '잘못된 좌표 가게',
          address: '제주시 한경면',
          latitude: 200,
          longitude: 126.3098
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/admin/stores', () => {
    beforeEach(async () => {
      await prisma.restaurant.createMany({
        data: [
          {
            storeType: 'convenience_store',
            name: 'CU 한경면점',
            address: '제주시 한경면',
            latitude: 33.3615,
            longitude: 126.3098,
            brandName: 'CU',
            isActive: true,
            isDeliverable: true
          },
          {
            storeType: 'convenience_store',
            name: 'GS25 한경면점',
            address: '제주시 한경면',
            latitude: 33.3700,
            longitude: 126.3100,
            brandName: 'GS25',
            isActive: true,
            isDeliverable: true
          },
          {
            storeType: 'restaurant',
            name: '테스트 식당',
            address: '제주시 한경면',
            latitude: 33.3615,
            longitude: 126.3098,
            isActive: true,
            isDeliverable: true
          }
        ]
      });
    });

    it('편의점만 필터링하여 조회', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stores')
        .query({ storeType: 'convenience_store' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((s: any) => s.storeType === 'convenience_store')).toBe(true);
    });

    it('식당만 필터링하여 조회', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stores')
        .query({ storeType: 'restaurant' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].storeType).toBe('restaurant');
    });

    it('필터 없이 전체 조회', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stores');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/v1/admin/stores/:id', () => {
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
          operatingHours24: true,
          isActive: true,
          isDeliverable: true
        }
      });
      storeId = store.id;
    });

    it('편의점 상세 조회 성공', async () => {
      const response = await request(app)
        .get(`/api/v1/admin/stores/${storeId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(storeId);
      expect(response.body.data.name).toBe('CU 한경면점');
      expect(response.body.data.brandName).toBe('CU');
      expect(response.body.data.operatingHours24).toBe(true);
    });

    it('존재하지 않는 ID로 조회 시 404', async () => {
      const response = await request(app)
        .get('/api/v1/admin/stores/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/admin/stores/:id', () => {
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
          operatingHours24: false,
          isActive: true,
          isDeliverable: true
        }
      });
      storeId = store.id;
    });

    it('편의점 정보 수정 성공', async () => {
      const response = await request(app)
        .put(`/api/v1/admin/stores/${storeId}`)
        .send({
          name: 'CU 한경면점 (수정)',
          operatingHours24: true,
          deliveryRadius: 3.0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('CU 한경면점 (수정)');
      expect(response.body.data.operatingHours24).toBe(true);
      expect(response.body.data.deliveryRadius).toBe(3.0);
    });

    it('존재하지 않는 ID 수정 시 404', async () => {
      const response = await request(app)
        .put('/api/v1/admin/stores/non-existent-id')
        .send({ name: '수정' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/admin/stores/:id', () => {
    let storeId: string;

    beforeEach(async () => {
      const store = await prisma.restaurant.create({
        data: {
          storeType: 'convenience_store',
          name: '삭제될 편의점',
          address: '제주시 한경면',
          latitude: 33.3615,
          longitude: 126.3098,
          isActive: true,
          isDeliverable: true
        }
      });
      storeId = store.id;
    });

    it('편의점 삭제 성공', async () => {
      const response = await request(app)
        .delete(`/api/v1/admin/stores/${storeId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deleted = await prisma.restaurant.findUnique({
        where: { id: storeId }
      });
      expect(deleted).toBeNull();
    });

    it('존재하지 않는 ID 삭제 시 404', async () => {
      const response = await request(app)
        .delete('/api/v1/admin/stores/non-existent-id');

      expect(response.status).toBe(404);
    });
  });
});
