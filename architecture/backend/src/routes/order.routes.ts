import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/OrderService';
import { OrderStatusEnum } from '../types/prisma';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      userId, 
      phone,
      name,
      restaurantId, 
      items, 
      deliveryAddress, 
      deliveryLat, 
      deliveryLng, 
      customerMemo,
      impUid 
    } = req.body;

    let finalUserId = userId;

    if (!finalUserId && phone) {
      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone, name: name || null },
        });
      }
      finalUserId = user.id;
    }

    if (!finalUserId) {
      return res.status(400).json({
        success: false,
        error: 'userId 또는 phone이 필요합니다.',
      });
    }

    const order = await orderService.createOrderWithPayment({
      userId: finalUserId,
      restaurantId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      customerMemo,
      impUid,
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    if (error.message.includes('성인 인증')) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    if (error.message.includes('배달 가능 지역') || error.message.includes('재고') || error.message.includes('품절') || error.message.includes('not available')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: '주문 항목이 필요합니다.',
      });
    }

    const validation = await orderService.validateOrderItems(items);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error: any) {
    if (error.message.includes('not available')) {
      return res.status(400).json({
        success: false,
        error: '일부 상품을 사용할 수 없습니다.',
      });
    }
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, date } = req.query;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: '전화번호가 필요합니다',
      });
    }

    const user = await prisma.user.findUnique({
      where: { phone: phone as string },
    });

    if (!user) {
      return res.json({
        success: true,
        data: [],
      });
    }

    let startDate: Date;
    let endDate: Date;

    if (date) {
      startDate = new Date(date as string);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date as string);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: true,
        items: true,
        user: true,
      },
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/pickup-time', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { pickupTime, restaurantMemo } = req.body;

    const order = await orderService.setPickupTime({
      orderId: id,
      pickupTime: new Date(pickupTime),
      restaurantMemo,
    });

    res.json({
      success: true,
      message: '픽업 가능 시간 설정 및 SMS 발송 완료',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/confirm/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const order = await orderService.confirmOrder(token);

    res.json({
      success: true,
      message: '주문이 확정되었습니다',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cancel/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const order = await orderService.cancelOrderByCustomer(token);

    res.json({
      success: true,
      message: '주문이 취소되었습니다',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pickup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { restaurantPaidAmount } = req.body;

    const order = await orderService.markAsPickedUp(id, restaurantPaidAmount);

    res.json({
      success: true,
      message: '픽업 처리 완료 (실물 카드 결제)',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        restaurantPaidAmount: order.restaurantPaidAmount,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/delivering', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const order = await orderService.markAsDelivering(id);

    res.json({
      success: true,
      message: '배달 시작 처리 완료',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const order = await orderService.markAsCompleted(id);

    res.json({
      success: true,
      message: '배달 완료 처리 완료',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/status/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;
    const { phone } = req.query;

    const orders = await orderService.getOrdersByUser(phone as string);
    const order = orders.find(o => o.orderNumber === orderNumber);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await orderService.getPendingOrders();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pending-confirmation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await orderService.getPendingConfirmationOrders();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/confirmed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await orderService.getConfirmedOrders();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
