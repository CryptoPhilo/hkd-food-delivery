import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/start-duty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, name, cardNumber } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    let driver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (driver) {
      if (driver.isOnDuty) {
        return res.status(400).json({
          success: false,
          error: '이미 업무 중입니다',
        });
      }

      driver = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          isOnDuty: true,
          dutyStartedAt: new Date(),
          dutyEndedAt: null,
          name: name || driver.name,
          cardNumber: cardNumber || driver.cardNumber,
        },
      });
    } else {
      driver = await prisma.driver.create({
        data: {
          phone,
          name: name || null,
          cardNumber: cardNumber || null,
          isOnDuty: true,
          dutyStartedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      message: '업무를 개시했습니다',
      data: driver,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/end-duty', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: '배달원을 찾을 수 없습니다',
      });
    }

    if (!driver.isOnDuty) {
      return res.status(400).json({
        success: false,
        error: '업무 중이 아닙니다',
      });
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        isOnDuty: false,
        dutyEndedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: '업무를 종료했습니다',
      data: updatedDriver,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/status/:phone', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (!driver) {
      return res.json({
        success: true,
        data: null,
      });
    }

    res.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/deliveries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, date, startDate, endDate } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { phone: phone as string },
    });

    if (!driver) {
      return res.json({
        success: true,
        data: {
          driver: null,
          deliveries: [],
          summary: {
            totalDeliveries: 0,
            totalDeliveryFee: 0,
          },
        },
      });
    }

    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
    } else if (date) {
      start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      end = new Date(date as string);
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const deliveries = await prisma.order.findMany({
      where: {
        driverId: driver.id,
        deliveredAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { deliveredAt: 'desc' },
      include: {
        restaurant: true,
        user: true,
        items: true,
      },
    });

    const totalDeliveryFee = deliveries.reduce((sum, d) => sum + d.deliveryFee, 0);

    res.json({
      success: true,
      data: {
        driver,
        deliveries,
        summary: {
          totalDeliveries: deliveries.length,
          totalDeliveryFee,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        driverId: null,
        status: {
          in: ['order_confirmed', 'picked_up'],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        restaurant: true,
        user: true,
        items: true,
      },
    });

    const deliveryGroups: any[] = [];
    const processedOrderIds = new Set();

    for (const order of orders) {
      if (processedOrderIds.has(order.id)) continue;

      const timeKey = new Date(order.createdAt).getTime();
      const timeBucket = Math.floor(timeKey / 60000);

      const relatedOrders = orders.filter(o => {
        if (processedOrderIds.has(o.id)) return false;
        const oTimeBucket = Math.floor(new Date(o.createdAt).getTime() / 60000);
        return o.userId === order.userId &&
               o.deliveryAddress === order.deliveryAddress &&
               oTimeBucket === timeBucket;
      });

      if (relatedOrders.length > 0) {
        const totalDeliveryFee = relatedOrders.reduce((sum, o) => sum + o.deliveryFee, 0);

        deliveryGroups.push({
          id: `${order.userId}_${order.deliveryAddress}_${timeBucket}`,
          deliveryAddress: order.deliveryAddress,
          deliveryLatitude: order.deliveryLatitude,
          deliveryLongitude: order.deliveryLongitude,
          customerName: order.user.name,
          customerPhone: order.user.phone,
          customerMemo: order.customerMemo,
          orders: relatedOrders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            restaurantName: o.restaurant.name,
            items: o.items.map(i => `${i.menuName} x${i.quantity}`),
            subtotal: o.subtotal,
          })),
          totalDeliveryFee,
          createdAt: order.createdAt,
        });

        relatedOrders.forEach(o => processedOrderIds.add(o.id));
      }
    }

    res.json({
      success: true,
      data: deliveryGroups,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/my-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { phone: phone as string },
    });

    if (!driver) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const orders = await prisma.order.findMany({
      where: {
        driverId: driver.id,
        status: {
          notIn: ['completed', 'cancelled'],
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        restaurant: true,
        user: true,
        items: true,
      },
    });

    res.json({
      success: true,
      data: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        deliveryFee: order.deliveryFee,
        customerName: order.user.name,
        customerPhone: order.user.phone,
        customerMemo: order.customerMemo,
        restaurantName: order.restaurant.name,
        items: order.items.map(i => `${i.menuName} x${i.quantity}`),
        createdAt: order.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/assign/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (!driver || !driver.isOnDuty) {
      return res.status(400).json({
        success: false,
        error: '업무 중인 배달원이 아닙니다',
      });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { driverId: driver.id },
      include: {
        restaurant: true,
        user: true,
        items: true,
        driver: true,
      },
    });

    res.json({
      success: true,
      message: '배달이 할당되었습니다',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/assign-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderIds, phone } = req.body;

    if (!phone || !orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '전화번호와 주문 ID가 필요합니다',
      });
    }

    const driver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (!driver || !driver.isOnDuty) {
      return res.status(400).json({
        success: false,
        error: '업무 중인 배달원이 아닙니다',
      });
    }

    const updatedOrders = await Promise.all(
      orderIds.map(orderId =>
        prisma.order.update({
          where: { id: orderId },
          data: { driverId: driver.id },
        })
      )
    );

    res.json({
      success: true,
      message: `${updatedOrders.length}개 주문이 배정되었습니다`,
      data: updatedOrders,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/complete/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: true },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: '주문을 찾을 수 없습니다',
      });
    }

    if (!order.driverId) {
      return res.status(400).json({
        success: false,
        error: '배달원이 할당되지 않았습니다',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'completed',
        deliveredAt: new Date(),
      },
    });

    await prisma.driver.update({
      where: { id: order.driverId },
      data: {
        totalDeliveries: { increment: 1 },
        totalDeliveryFee: { increment: order.deliveryFee },
      },
    });

    res.json({
      success: true,
      message: '배달이 완료되었습니다',
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isOnDuty } = req.query;

    const whereClause: any = {};
    if (isOnDuty !== undefined) {
      whereClause.isOnDuty = isOnDuty === 'true';
    }

    const drivers = await prisma.driver.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: drivers,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, name, cardNumber } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const existingDriver = await prisma.driver.findUnique({
      where: { phone },
    });

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        error: '이미 등록된 배달원입니다',
      });
    }

    const driver = await prisma.driver.create({
      data: {
        phone,
        name: name || null,
        cardNumber: cardNumber || null,
      },
    });

    res.json({
      success: true,
      message: '배달원이 등록되었습니다',
      data: driver,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: { orders: true },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: '배달원을 찾을 수 없습니다',
      });
    }

    if (driver.isOnDuty) {
      return res.status(400).json({
        success: false,
        error: '업무 중인 배달원은 삭제할 수 없습니다. 먼저 업무를 종료해주세요.',
      });
    }

    const pendingOrders = driver.orders.filter(o => 
      o.status !== 'completed' && o.status !== 'cancelled'
    );

    if (pendingOrders.length > 0) {
      return res.status(400).json({
        success: false,
        error: '미완료 배달이 있는 배달원은 삭제할 수 없습니다',
      });
    }

    await prisma.driver.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: '배달원이 삭제되었습니다',
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, cardNumber } = req.body;

    const driver = await prisma.driver.update({
      where: { id },
      data: {
        name: name || undefined,
        cardNumber: cardNumber || undefined,
      },
    });

    res.json({
      success: true,
      message: '배달원 정보가 수정되었습니다',
      data: driver,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
