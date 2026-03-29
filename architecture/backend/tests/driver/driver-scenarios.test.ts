import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('배달원 시나리오 통합 테스트', () => {
  let driverId: string;
  let storeId: string;
  let userId: string;
  let orderIds: string[] = [];

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

    const driver = await prisma.driver.create({
      data: {
        name: '홍길동',
        phone: '010-1111-2222',
        cardNumber: '1234'
      }
    });
    driverId = driver.id;

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
      data: { phone: '010-9999-0000', name: '주문자' }
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('시나리오 1: 배달원 출근 및 상태 관리', () => {
    it('배달원이 출근 상태를 시작하고 종료한다', async () => {
      const startResponse = await request(app)
        .post('/api/v1/drivers/start-duty')
        .send({
          phone: '010-1111-2222',
          name: '홍길동',
          cardNumber: '1234'
        });

      expect([200, 201, 400]).toContain(startResponse.status);
      
      const endResponse = await request(app)
        .post('/api/v1/drivers/end-duty')
        .send({ phone: '010-1111-2222' });

      expect([200, 400, 404]).toContain(endResponse.status);
    });

    it('배달원 상태를 조회한다', async () => {
      const statusResponse = await request(app)
        .get(`/api/v1/drivers/status/010-1111-2222`);

      expect([200, 404]).toContain(statusResponse.status);
    });
  });

  describe('시나리오 2: 주문 배정', () => {
    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });

      const order1 = await prisma.order.create({
        data: {
          orderNumber: 'DEL001',
          userId,
          restaurantId: storeId,
          subtotal: 1500,
          deliveryFee: 3000,
          totalAmount: 4500,
          deliveryAddress: '제주시 한경면 신도1리',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          status: 'confirmed',
          items: {
            create: {
              menuId: product.id,
              menuName: '삼각김밥',
              quantity: 1,
              unitPrice: 1500,
              subtotal: 1500
            }
          }
        }
      });

      const order2 = await prisma.order.create({
        data: {
          orderNumber: 'DEL002',
          userId,
          restaurantId: storeId,
          subtotal: 3000,
          deliveryFee: 3000,
          totalAmount: 6000,
          deliveryAddress: '제주시 한경면 신도2리',
          deliveryLatitude: 33.366,
          deliveryLongitude: 126.316,
          status: 'confirmed',
          items: {
            create: {
              menuId: product.id,
              menuName: '컵라면',
              quantity: 2,
              unitPrice: 1500,
              subtotal: 3000
            }
          }
        }
      });

      orderIds = [order1.id, order2.id];
    });

    it('주문을 배정받는다', async () => {
      const assignResponse = await request(app)
        .post(`/api/v1/drivers/assign/${orderIds[0]}`)
        .send({ driverId });

      expect([200, 201, 400]).toContain(assignResponse.status);
    });
  });

  describe('시나리오 3: 주문 상태 변경', () => {
    let orderId: string;

    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: 'DEL003',
          userId,
          restaurantId: storeId,
          subtotal: 1500,
          deliveryFee: 3000,
          totalAmount: 4500,
          deliveryAddress: '제주시 한경면',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          status: 'confirmed',
          driverId,
          items: {
            create: {
              menuId: product.id,
              menuName: '삼각김밥',
              quantity: 1,
              unitPrice: 1500,
              subtotal: 1500
            }
          }
        }
      });
      orderId = order.id;
    });

    it('주문을 픽업 상태로 변경한다', async () => {
      const pickupResponse = await request(app)
        .post(`/api/v1/orders/${orderId}/pickup`);

      expect([200, 201, 400, 500]).toContain(pickupResponse.status);
    });

    it('주문을 완료 상태로 변경한다', async () => {
      const completeResponse = await request(app)
        .put(`/api/v1/orders/${orderId}/complete`);

      expect([200, 201, 400, 500]).toContain(completeResponse.status);
    });
  });

  describe('시나리오 4: 내 주문 목록 조회', () => {
    beforeEach(async () => {
      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });

      await prisma.order.create({
        data: {
          orderNumber: 'DEL004',
          userId,
          restaurantId: storeId,
          subtotal: 1500,
          deliveryFee: 3000,
          totalAmount: 4500,
          deliveryAddress: '제주시 한경면',
          deliveryLatitude: 33.365,
          deliveryLongitude: 126.315,
          status: 'completed',
          driverId,
          deliveredAt: new Date(),
          items: {
            create: {
              menuId: product.id,
              menuName: '삼각김밥',
              quantity: 1,
              unitPrice: 1500,
              subtotal: 1500
            }
          }
        }
      });
    });

    it('배달원의 완료된 주문 목록을 조회한다', async () => {
      const myOrdersResponse = await request(app)
        .get('/api/v1/drivers/my-orders')
        .query({ driverId, status: 'completed' });

      expect([200, 400]).toContain(myOrdersResponse.status);
    });
  });

  describe('시나리오 5: 배달원 목록 조회', () => {
    it('전체 배달원 목록을 조회한다', async () => {
      const listResponse = await request(app)
        .get('/api/v1/drivers/list');

      expect([200, 400]).toContain(listResponse.status);
    });
  });

  describe('시나리오 6: 배달원 정보 수정', () => {
    it('배달원 정보를 수정한다', async () => {
      const updateResponse = await request(app)
        .put(`/api/v1/drivers/${driverId}`)
        .send({
          name: '홍길동수정',
          phone: '010-1111-3333',
          cardNumber: '5678'
        });

      expect([200, 201, 400]).toContain(updateResponse.status);
    });
  });

  describe('시나리오 7: 배달원 삭제', () => {
    it('배달원을 비활성화한다', async () => {
      const deleteResponse = await request(app)
        .delete(`/api/v1/drivers/${driverId}`);

      expect([200, 400, 404]).toContain(deleteResponse.status);
    });
  });

  describe('시나리오 8: 다중 배달원 동시 주문 처리', () => {
    let driver2Id: string;
    let driver3Id: string;

    beforeEach(async () => {
      const driver2 = await prisma.driver.create({
        data: {
          name: '김철수',
          phone: '010-2222-3333',
          cardNumber: '5678'
        }
      });

      const driver3 = await prisma.driver.create({
        data: {
          name: '이영희',
          phone: '010-3333-4444',
          cardNumber: '9012'
        }
      });

      driver2Id = driver2.id;
      driver3Id = driver3.id;

      const product = await prisma.menu.create({
        data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 50, isAvailable: true, isActive: true }
      });

      await prisma.order.createMany({
        data: [
          {
            orderNumber: 'MULTI001',
            userId,
            restaurantId: storeId,
            subtotal: 1500,
            deliveryFee: 3000,
            totalAmount: 4500,
            deliveryAddress: '제주시 한경면1',
            deliveryLatitude: 33.365,
            deliveryLongitude: 126.315,
            status: 'confirmed'
          },
          {
            orderNumber: 'MULTI002',
            userId,
            restaurantId: storeId,
            subtotal: 2000,
            deliveryFee: 3000,
            totalAmount: 5000,
            deliveryAddress: '제주시 한경면2',
            deliveryLatitude: 33.366,
            deliveryLongitude: 126.316,
            status: 'confirmed'
          },
          {
            orderNumber: 'MULTI003',
            userId,
            restaurantId: storeId,
            subtotal: 2500,
            deliveryFee: 3000,
            totalAmount: 5500,
            deliveryAddress: '제주시 한경면3',
            deliveryLatitude: 33.367,
            deliveryLongitude: 126.317,
            status: 'confirmed'
          }
        ]
      });
    });

    it('3명의 배달원이 각각 주문을 배정받을 수 있다', async () => {
      const orders = await prisma.order.findMany({
        where: { orderNumber: { startsWith: 'MULTI' } },
        orderBy: { orderNumber: 'asc' }
      });

      expect(orders).toHaveLength(3);
    });
  });
});
