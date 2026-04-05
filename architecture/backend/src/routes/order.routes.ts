import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/OrderService';
import { OrderStatusEnum } from '../types/prisma';
import { PrismaClient } from '@prisma/client';
import {
  validateCreateOrder,
  validateParamId,
  validatePickupTime,
  validateOrderPickup,
  validatePhoneParam,
  validateDateParam,
} from '../middleware/validation.middleware';
import { orderCreateRateLimit } from '../middleware/security.middleware';
import {
  authenticateToken,
  authenticateAdmin,
  authenticateDriver,
  authenticateAny,
  verifyOrderOwnership,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

/**
 * [SECURITY] User 객체에서 민감 필드를 제외한 안전한 select 정의
 * (CRITICAL-03 보안 취약점 수정)
 */
const safeUserSelect = {
  id: true,
  phone: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

// ============================================
// 관리자 전용 라우트 (정적 경로 — 동적 경로보다 먼저 선언)
// ============================================

/**
 * GET /api/v1/orders/pending — 대기 중인 주문 목록 (관리자 전용)
 */
router.get('/pending', authenticateAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /api/v1/orders/pending-confirmation — 확정 대기 주문 목록 (관리자 전용)
 */
router.get('/pending-confirmation', authenticateAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /api/v1/orders/confirmed — 확정된 주문 목록 (관리자 전용)
 */
router.get('/confirmed', authenticateAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * GET /api/v1/orders/status/:orderNumber — 주문 상태 조회 (인증 필수)
 */
router.get('/status/:orderNumber', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;

    const orders = await orderService.getOrdersByUser(req.user!.phone);
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

// ============================================
// 토큰 기반 라우트 (인증 불필요 — Confirm Token 자체가 인증 역할)
// ============================================

/**
 * POST /api/v1/orders/confirm/:token — 주문 확정 (Confirm Token 기반)
 */
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

/**
 * POST /api/v1/orders/cancel/:token — 주문 취소 (Confirm Token 기반)
 */
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

/**
 * POST /api/v1/orders/validate — 주문 항목 유효성 검증 (인증 필수)
 */
router.post('/validate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// ============================================
// 고객 인증 필수 라우트
// ============================================

/**
 * POST /api/v1/orders — 주문 생성 (고객 인증 필수)
 */
router.post('/', authenticateToken, orderCreateRateLimit, validateCreateOrder, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const {
      restaurantId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      customerMemo,
      impUid,
      paymentId,
      paymentMethod,
      deliveryFee: clientDeliveryFee,
      locale = 'ko',
      deliveryGroupId,
    } = req.body;

    // paymentId(PortOne V2)를 impUid로도 사용
    const finalImpUid = impUid || paymentId;

    // 인증된 사용자의 ID를 사용 (req.body의 userId 무시)
    const finalUserId = req.user!.userId;

    const order = await orderService.createOrderWithPayment({
      userId: finalUserId,
      restaurantId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      customerMemo,
      impUid: finalImpUid,
      clientDeliveryFee: clientDeliveryFee !== undefined ? Number(clientDeliveryFee) : undefined,
      locale,
      deliveryGroupId,
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
    // [SECURITY] 잘못된 리소스 ID에 대해 500 대신 적절한 상태코드 반환 (MEDIUM-04)
    if (error.message.includes('Restaurant not found') || error.message.includes('Order not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    if (error.message.includes('배달 가능 지역') || error.message.includes('재고') || error.message.includes('품절') || error.message.includes('not available') || error.message.includes('사용할 수 없습니다')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * GET /api/v1/orders — 내 주문 목록 조회 (고객 인증 필수)
 * phone 쿼리 파라미터 대신 JWT에서 사용자 정보 추출
 */
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.query;
    const userId = req.user!.userId;

    let startDate: Date;
    let endDate: Date;

    // KST (UTC+9) 기준으로 날짜 범위 설정
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    if (date) {
      startDate = new Date(`${date}T00:00:00+09:00`);
      endDate = new Date(`${date}T23:59:59.999+09:00`);
    } else {
      const nowKST = new Date(Date.now() + KST_OFFSET);
      const todayStr = nowKST.toISOString().split('T')[0];
      startDate = new Date(`${todayStr}T00:00:00+09:00`);
      endDate = new Date(`${todayStr}T23:59:59.999+09:00`);
    }

    const orders = await prisma.order.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: true,
        items: true,
        user: { select: safeUserSelect },
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

// ============================================
// 주문 상세 — 다중 역할 접근 가능 (고객/배달원/관리자)
// ============================================

/**
 * GET /api/v1/orders/:id — 주문 상세 조회 (인증 + 소유권 검증)
 */
router.get('/:id', authenticateAny, verifyOrderOwnership, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
      });
    }

    // 복수 식당 배달 그룹 정보 포함
    let deliveryGroup = null;
    if ((order as any).deliveryGroupId) {
      deliveryGroup = await orderService.getDeliveryGroupInfo((order as any).deliveryGroupId);
    }

    res.json({
      success: true,
      data: {
        ...order,
        deliveryGroup,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 식당 운영 라우트 (관리자 인증 필수)
// ============================================

/**
 * PUT /api/v1/orders/:id/pickup-time — 픽업 시간 설정 (관리자 전용)
 */
router.put('/:id/pickup-time', authenticateAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /api/v1/orders/:id/pickup — 픽업 처리 (관리자 전용)
 */
router.post('/:id/pickup', authenticateAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

// ============================================
// 배달 운영 라우트 (배달원 인증 필수)
// ============================================

/**
 * PUT /api/v1/orders/:id/delivering — 배달 시작 (배달원 전용)
 */
router.put('/:id/delivering', authenticateDriver, async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * PUT /api/v1/orders/:id/complete — 배달 완료 (배달원 전용)
 */
router.put('/:id/complete', authenticateDriver, async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
