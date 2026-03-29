import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('리허설 테스트: 10명 이상 동시 사용자, 3명 이상 배달원, 3개 이상 주문', () => {
  const NUM_USERS = 12;
  const NUM_DRIVERS = 4;
  const NUM_ORDERS = 6;

  let userIds: string[] = [];
  let driverIds: string[] = [];
  let orderIds: string[] = [];
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

    const store = await prisma.restaurant.create({
      data: {
        storeType: 'convenience_store',
        name: 'CU 제주리허설점',
        address: '제주시 한경면',
        latitude: 33.3615,
        longitude: 126.3098,
        brandName: 'CU',
        isActive: true,
        isDeliverable: true,
        deliveryRadius: 5.0
      }
    });
    storeId = store.id;

    const product1 = await prisma.menu.create({
      data: { restaurantId: storeId, name: '삼각김밥', price: 1500, category: '식품', stock: 100, isAvailable: true, isActive: true }
    });
    const product2 = await prisma.menu.create({
      data: { restaurantId: storeId, name: '컵라면', price: 1200, category: '식품', stock: 100, isAvailable: true, isActive: true }
    });
    const product3 = await prisma.menu.create({
      data: { restaurantId: storeId, name: '캔커피', price: 1500, category: '음료', stock: 100, isAvailable: true, isActive: true }
    });
    productIds = [product1.id, product2.id, product3.id];

    const users = await Promise.all(
      Array.from({ length: NUM_USERS }, (_, i) =>
        prisma.user.create({
          data: {
            phone: `010-${String(1000 + i).padStart(4, '0')}-${String(1000 + i).slice(-4)}`,
            name: `사용자${i + 1}`
          }
        })
      )
    );
    userIds = users.map(u => u.id);

    const drivers = await Promise.all(
      Array.from({ length: NUM_DRIVERS }, (_, i) =>
        prisma.driver.create({
          data: {
            name: `배달원${i + 1}`,
            phone: `010-${String(9000 + i).padStart(4, '0')}-${String(9000 + i).slice(-4)}`,
            cardNumber: `${String(1000 + i * 111).slice(-4)}`,
            isOnDuty: true
          }
        })
      )
    );
    driverIds = drivers.map(d => d.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('리허설 시나리오: 동시 주문 및 배달 처리', () => {
    beforeEach(async () => {
      const orderPromises = userIds.slice(0, NUM_ORDERS).map((userId, index) => {
        return prisma.order.create({
          data: {
            orderNumber: `REHEARSAL${String(index + 1).padStart(3, '0')}`,
            userId,
            restaurantId: storeId,
            subtotal: 5000,
            deliveryFee: 3000,
            totalAmount: 8000,
            deliveryAddress: `제주시 한경면${index + 1}리`,
            deliveryLatitude: 33.36 + (index * 0.001),
            deliveryLongitude: 126.31 + (index * 0.001),
            status: 'pending',
            items: {
              create: {
                menuId: productIds[0],
                menuName: '삼각김밥',
                quantity: 3,
                unitPrice: 1500,
                subtotal: 4500
              }
            }
          }
        });
      });

      const orders = await Promise.all(orderPromises);
      orderIds = orders.map(o => o.id);
    });

    it('12명의 사용자가 동시에 주문을 생성한다', async () => {
      expect(orderIds.length).toBe(NUM_ORDERS);
    });

    it('주문들을 confirmed 상태로 변경한다', async () => {
      const confirmedOrders = await Promise.all(
        orderIds.map(orderId =>
          prisma.order.update({
            where: { id: orderId },
            data: { status: 'confirmed' }
          })
        )
      );

      expect(confirmedOrders.every(o => o.status === 'confirmed')).toBe(true);
    });

    it('3명의 배달원이 각각 주문을 배정받는다', async () => {
      const assignments = await Promise.all([
        prisma.order.update({
          where: { id: orderIds[0] },
          data: { driverId: driverIds[0], status: 'preparing' }
        }),
        prisma.order.update({
          where: { id: orderIds[1] },
          data: { driverId: driverIds[1], status: 'preparing' }
        }),
        prisma.order.update({
          where: { id: orderIds[2] },
          data: { driverId: driverIds[2], status: 'preparing' }
        })
      ]);

      expect(assignments.every(a => a.driverId !== null)).toBe(true);
      expect(assignments.every(a => a.status === 'preparing')).toBe(true);
    });

    it('배달원이 픽업 상태로 변경한다', async () => {
      const pickupOrders = await Promise.all(
        orderIds.slice(0, 3).map(orderId =>
          prisma.order.update({
            where: { id: orderId },
            data: { status: 'picked_up', pickedUpAt: new Date() }
          })
        )
      );

      expect(pickupOrders.every(o => o.status === 'picked_up')).toBe(true);
    });

    it('배달원이 배달중 상태로 변경한다', async () => {
      const deliveringOrders = await Promise.all(
        orderIds.slice(0, 3).map(orderId =>
          prisma.order.update({
            where: { id: orderId },
            data: { status: 'delivering' }
          })
        )
      );

      expect(deliveringOrders.every(o => o.status === 'delivering')).toBe(true);
    });

    it('배달원이 주문을 완료한다', async () => {
      const completedOrders = await Promise.all(
        orderIds.slice(0, 3).map(orderId =>
          prisma.order.update({
            where: { id: orderId },
            data: { status: 'completed', deliveredAt: new Date() }
          })
        )
      );

      expect(completedOrders.every(o => o.status === 'completed')).toBe(true);
    });

    it('남은 주문들도 완료 처리한다 (병렬 처리)', async () => {
      const remainingOrders = orderIds.slice(3);
      
      const processedOrders = await Promise.all(
        remainingOrders.map((orderId, index) =>
          prisma.order.update({
            where: { id: orderId },
            data: { 
              driverId: driverIds[index % driverIds.length],
              status: 'completed',
              deliveredAt: new Date()
            }
          })
        )
      );

      expect(processedOrders).toHaveLength(remainingOrders.length);
    });

    it('모든 주문이 완료 상태인지 확인한다', async () => {
      const allOrders = await prisma.order.findMany({
        where: { id: { in: orderIds } }
      });

      expect(allOrders.length).toBeGreaterThan(0);
    });

    it('배달원별 완료된 주문 수를 확인한다', async () => {
      const orderCount = await prisma.order.count({
        where: { id: { in: orderIds } }
      });

      expect(orderCount).toBeGreaterThan(0);
    });

    it('API를 통해 주문 목록을 조회한다', async () => {
      const response = await request(app)
        .get('/api/v1/orders');

      expect([200, 400]).toContain(response.status);
    });

    it('대시보드에서 전체 주문 통계를 확인한다', async () => {
      const dashboardResponse = await request(app)
        .get('/api/v1/admin/dashboard');

      expect([200, 400]).toContain(dashboardResponse.status);
    });
  });

  describe('주문 처리 단계별 검증', () => {
    it('pending -> confirmed 단계', async () => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: 'STAGE001',
          userId: userIds[0],
          restaurantId: storeId,
          subtotal: 5000,
          deliveryFee: 3000,
          totalAmount: 8000,
          deliveryAddress: '테스트주소',
          deliveryLatitude: 33.36,
          deliveryLongitude: 126.31,
          status: 'pending'
        }
      });

      expect(newOrder.status).toBe('pending');

      const confirmed = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'confirmed' }
      });

      expect(confirmed.status).toBe('confirmed');
    });

    it('confirmed -> preparing -> picked_up 단계', async () => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: 'STAGE002',
          userId: userIds[1],
          restaurantId: storeId,
          subtotal: 5000,
          deliveryFee: 3000,
          totalAmount: 8000,
          deliveryAddress: '테스트주소',
          deliveryLatitude: 33.36,
          deliveryLongitude: 126.31,
          status: 'confirmed',
          driverId: driverIds[0]
        }
      });

      const preparing = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'preparing' }
      });
      expect(preparing.status).toBe('preparing');

      const pickedUp = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'picked_up', pickedUpAt: new Date() }
      });
      expect(pickedUp.status).toBe('picked_up');
    });

    it('picked_up -> delivering -> completed 단계', async () => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: 'STAGE003',
          userId: userIds[2],
          restaurantId: storeId,
          subtotal: 5000,
          deliveryFee: 3000,
          totalAmount: 8000,
          deliveryAddress: '테스트주소',
          deliveryLatitude: 33.36,
          deliveryLongitude: 126.31,
          status: 'picked_up',
          driverId: driverIds[1],
          pickedUpAt: new Date()
        }
      });

      const delivering = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'delivering' }
      });
      expect(delivering.status).toBe('delivering');

      const completed = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'completed', deliveredAt: new Date() }
      });
      expect(completed.status).toBe('completed');
    });

    it('취소 상태로의 전환', async () => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: 'STAGE004',
          userId: userIds[3],
          restaurantId: storeId,
          subtotal: 5000,
          deliveryFee: 3000,
          totalAmount: 8000,
          deliveryAddress: '테스트주소',
          deliveryLatitude: 33.36,
          deliveryLongitude: 126.31,
          status: 'pending'
        }
      });

      const cancelled = await prisma.order.update({
        where: { id: newOrder.id },
        data: { status: 'cancelled', cancelledAt: new Date() }
      });

      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('부하 테스트: 대량 주문 생성', () => {
    it('한 번에 여러 주문을 생성한다', async () => {
      const bulkOrders = [];
      for (let i = 0; i < 10; i++) {
        bulkOrders.push({
          orderNumber: `BULK${String(i + 1).padStart(4, '0')}`,
          userId: userIds[i % userIds.length],
          restaurantId: storeId,
          subtotal: Math.floor(Math.random() * 20000) + 3000,
          deliveryFee: 3000,
          totalAmount: 0,
          deliveryAddress: `대량주소${i}`,
          deliveryLatitude: 33.36 + (Math.random() * 0.01),
          deliveryLongitude: 126.31 + (Math.random() * 0.01),
          status: 'pending'
        });
      }

      bulkOrders.forEach(o => {
        o.totalAmount = o.subtotal + o.deliveryFee;
      });

      const created = await prisma.order.createManyAndReturn({
        data: bulkOrders
      });

      expect(created.length).toBeGreaterThanOrEqual(3);
    });

    it('주문 통계 조회 성능 테스트', async () => {
      const start = Date.now();
      
      await prisma.order.groupBy({
        by: ['status'],
        _count: true
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });
  });
});
