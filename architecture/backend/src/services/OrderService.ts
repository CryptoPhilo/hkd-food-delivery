import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { paymentService } from './PaymentService';
// SMS 제거 — 고객 알림은 웹 주문조회(polling)로 대체
import { ageVerificationService } from './AgeVerificationService';
import { OrderStatus, PaymentStatus, User, Restaurant, Order, OrderItem } from '../types/prisma';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * [SECURITY] User 객체에서 민감 필드를 제외한 안전한 select 정의
 * password, fcmToken 등 민감 정보가 API 응답에 포함되지 않도록 함
 * (CRITICAL-03 보안 취약점 수정)
 */
const safeUserSelect = {
  id: true,
  phone: true,
  name: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  // password, fcmToken, email 등은 의도적으로 제외
};

export { OrderStatus, PaymentStatus };

const OrderStatusEnum = {
  PENDING: 'pending',
  PENDING_CONFIRMATION: 'pending_confirmation',
  ORDER_CONFIRMED: 'order_confirmed',
  PICKED_UP: 'picked_up',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

interface CreateOrderInput {
  userId: string;
  restaurantId: string;
  items: {
    menuId: string;
    quantity: number;
  }[];
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  customerMemo?: string;
  ageVerificationId?: string;
  clientDeliveryFee?: number;
  locale?: string;
  deliveryGroupId?: string;
}

interface SetPickupTimeInput {
  orderId: string;
  pickupTime: Date;
  restaurantMemo?: string;
}

export class OrderService {
  private static instance: OrderService;

  static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    return this.createOrderWithPayment({ ...input, impUid: undefined });
  }

  async createOrderWithPayment(input: CreateOrderInput & { impUid?: string }): Promise<Order> {
    const { userId, restaurantId, items, deliveryAddress, deliveryLat, deliveryLng, customerMemo, ageVerificationId, clientDeliveryFee, locale = 'ko', deliveryGroupId } = input;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    const uniqueMenuIds = [...new Set(items.map(i => i.menuId))];
    const menuItems = await prisma.menu.findMany({
      where: {
        id: { in: uniqueMenuIds },
        restaurantId,
        isActive: true,
      },
    });

    const unavailableItems = menuItems.filter((item: any) => !item.isAvailable);
    if (unavailableItems.length > 0) {
      const names = unavailableItems.map((item: any) => item.name).join(', ');
      throw new Error(`${names}은(는) 품절입니다`);
    }

    if (menuItems.length !== uniqueMenuIds.length) {
      throw new Error('일부 상품을 사용할 수 없습니다');
    }

    const hasAgeRestrictedItems = menuItems.some(
      (item: any) => item.requiresAgeVerification || item.ageRestriction !== 'none'
    );

    if (hasAgeRestrictedItems) {
      if (ageVerificationId) {
        const verification = await prisma.ageVerification.findFirst({
          where: {
            id: ageVerificationId,
            userId,
            isVerified: true,
          },
        });
        
        if (verification) {
          const expiresAt = new Date(verification.expiresAt);
          const now = new Date();
          if (expiresAt.getTime() <= now.getTime()) {
            throw new Error('성인 인증이 만료되었습니다. 다시 인증해주세요.');
          }
        } else {
          throw new Error('성인 인증이 필요합니다');
        }
      } else {
        const isVerified = await ageVerificationService.isVerified(userId);
        if (!isVerified) {
          throw new Error('성인 인증이 필요합니다');
        }
      }
    }

    const itemQuantityMap = new Map<string, number>();
    for (const item of items) {
      const currentQty = itemQuantityMap.get(item.menuId) || 0;
      itemQuantityMap.set(item.menuId, currentQty + item.quantity);
    }

    for (const [menuId, totalQuantity] of itemQuantityMap.entries()) {
      const menu = menuItems.find((m: any) => m.id === menuId)!;
      if (menu.stock !== null && menu.stock !== undefined) {
        if (menu.stock === 0) {
          throw new Error(`${menu.name}은(는) 품절입니다`);
        }
        if (menu.stock < totalQuantity) {
          throw new Error(`${menu.name}의 재고가 부족합니다`);
        }
      }
    }

    let subtotal = 0;
    const orderItemData = items.map((item: { menuId: string; quantity: number }) => {
      const menu = menuItems.find((m: any) => m.id === item.menuId)!;
      const itemSubtotal = menu.price * item.quantity;
      subtotal += itemSubtotal;

      const requiresVerification = menu.requiresAgeVerification || menu.ageRestriction !== 'none';

      return {
        menuId: item.menuId,
        menuName: menu.name,
        quantity: item.quantity,
        unitPrice: menu.price,
        subtotal: itemSubtotal,
        requiresVerification,
        verifiedAt: requiresVerification ? new Date() : null,
      };
    });

    const { deliveryFee: calculatedFee, distance } = await this.calculateDeliveryFee(
      restaurant.latitude,
      restaurant.longitude,
      deliveryLat,
      deliveryLng
    );

    if (restaurant.deliveryRadius && distance > restaurant.deliveryRadius) {
      throw new Error(`배달 가능 지역을 초과했습니다. (최대 ${restaurant.deliveryRadius}km)`);
    }

    // 프론트엔드에서 전달된 배달비가 있으면 그 값을 사용 (결제 금액과 일치시키기 위해)
    const deliveryFee = (clientDeliveryFee !== undefined && clientDeliveryFee >= 0) ? clientDeliveryFee : calculatedFee;
    const totalAmount = subtotal + deliveryFee;
    const estimatedDeliveryTime = Math.ceil(20 + (distance / 30) * 60);
    const orderNumber = `HK${Date.now().toString(36).toUpperCase()}`;

    const order = await (prisma.order as any).create({
      data: {
        orderNumber,
        userId,
        restaurantId,
        status: OrderStatus.PENDING,
        subtotal,
        deliveryFee,
        totalAmount,
        paymentStatus: PaymentStatus.PENDING,
        deliveryAddress,
        deliveryLatitude: deliveryLat,
        deliveryLongitude: deliveryLng,
        customerMemo,
        locale,
        deliveryGroupId: deliveryGroupId || null,
        items: {
          create: orderItemData,
        },
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
    logger.info('[Order] 주문 접수 완료 (웹 조회로 대체)', { orderId: order.id });

    return order as any;
  }

  async setPickupTime(input: SetPickupTimeInput): Promise<Order> {
    const { orderId, pickupTime, restaurantMemo } = input;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: safeUserSelect }, restaurant: true, items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatusEnum.PENDING && order.status !== OrderStatusEnum.PENDING_CONFIRMATION) {
      throw new Error('Order cannot be modified in current status');
    }

    const confirmToken = uuidv4();
    const confirmTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatusEnum.PENDING_CONFIRMATION,
        estimatedPickupTime: pickupTime,
        restaurantMemo,
        confirmToken,
        confirmTokenExpiry,
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    const confirmUrl = `${process.env.FRONTEND_URL}/confirm/${confirmToken}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/cancel/${confirmToken}`;

    // SMS 제거 — 고객은 웹 주문조회에서 확인/취소 링크 접근
    logger.info('[Order] 픽업 확인 요청 (웹 조회로 대체)', { orderId: updatedOrder.id, confirmUrl, cancelUrl });

    return updatedOrder as any;
  }

  async confirmOrder(token: string): Promise<Order> {
    const order = await prisma.order.findFirst({
      where: {
        confirmToken: token,
        status: OrderStatusEnum.PENDING_CONFIRMATION,
      },
      include: { user: { select: safeUserSelect }, restaurant: true, items: true },
    });

    if (!order) {
      throw new Error('Invalid or expired confirmation token');
    }

    if (order.confirmTokenExpiry && order.confirmTokenExpiry < new Date()) {
      throw new Error('Confirmation token has expired');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatusEnum.ORDER_CONFIRMED,
        confirmedAt: new Date(),
        confirmToken: null,
        confirmTokenExpiry: null,
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
    logger.info('[Order] 주문 확인 완료 (웹 조회로 대체)', { orderId: updatedOrder.id });

    return updatedOrder as any;
  }

  async cancelOrderByCustomer(token: string): Promise<Order> {
    const order = await prisma.order.findFirst({
      where: {
        confirmToken: token,
        status: OrderStatusEnum.PENDING_CONFIRMATION,
      },
    });

    if (!order) {
      throw new Error('Invalid or expired token');
    }

    return this.cancelOrder(order.id, 'Customer cancelled during confirmation');
  }

  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const cancellableStatuses = [
      OrderStatusEnum.PENDING,
      OrderStatusEnum.PENDING_CONFIRMATION,
      OrderStatusEnum.ORDER_CONFIRMED,
    ];

    if (!cancellableStatuses.includes(order.status as any)) {
      throw new Error('Order cannot be cancelled in current status');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatusEnum.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
    logger.info('[Order] 주문 취소 완료 (웹 조회로 대체)', { orderId: updatedOrder.id });

    return updatedOrder as any;
  }

  async markAsPickedUp(orderId: string, restaurantPaidAmount?: number): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: safeUserSelect }, restaurant: true, items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== OrderStatusEnum.ORDER_CONFIRMED) {
      throw new Error('Order must be confirmed before pickup');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatusEnum.PICKED_UP,
        pickedUpAt: new Date(),
        pickupTime: new Date(),
        restaurantPaidAmount: restaurantPaidAmount || order.subtotal,
        restaurantPaidAt: new Date(),
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    const locale = (order as any).locale || 'ko';

    // 복수 식당 주문 그룹 여부 확인
    if ((order as any).deliveryGroupId) {
      // 같은 배달 그룹의 전체 주문 조회
      const groupOrders = await (prisma.order as any).findMany({
        where: { deliveryGroupId: (order as any).deliveryGroupId },
        include: { restaurant: true },
      });

      const totalCount = groupOrders.length;
      const pickedUpCount = groupOrders.filter((o: any) =>
        ['picked_up', 'delivering', 'completed'].includes(o.status)
      ).length;
      const remaining = totalCount - pickedUpCount;

      // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
      logger.info('[Order] 픽업 상태 변경 (웹 조회로 대체)', {
        orderId: updatedOrder.id,
        pickedUpCount,
        totalCount,
        remaining,
      });
    } else {
      logger.info('[Order] 픽업 완료 (웹 조회로 대체)', { orderId: updatedOrder.id });
    }

    return updatedOrder as any;
  }

  /**
   * 배달 그룹 정보를 조회 (주문 상세 API에서 사용)
   */
  async getDeliveryGroupInfo(deliveryGroupId: string) {
    const groupOrders = await (prisma.order as any).findMany({
      where: { deliveryGroupId },
      include: { restaurant: true, items: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalOrders = groupOrders.length;
    const pickedUpOrders = groupOrders.filter((o: any) =>
      ['picked_up', 'delivering', 'completed'].includes(o.status)
    ).length;

    // 그룹 전체 금액 합산
    const groupSubtotal = groupOrders.reduce((sum: number, o: any) => sum + Number(o.subtotal || 0), 0);
    const groupDeliveryFee = groupOrders.reduce((sum: number, o: any) => sum + Number(o.deliveryFee || 0), 0);
    const groupTotalAmount = groupOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);

    return {
      totalOrders,
      pickedUpOrders,
      groupSubtotal,
      groupDeliveryFee,
      groupTotalAmount,
      orders: groupOrders.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        restaurantName: o.restaurant.name,
        status: o.status,
        pickedUpAt: o.pickedUpAt,
        subtotal: Number(o.subtotal || 0),
        deliveryFee: Number(o.deliveryFee || 0),
        totalAmount: Number(o.totalAmount || 0),
        items: o.items.map((item: any) => ({
          id: item.id,
          menuName: item.menuName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice || 0),
          subtotal: Number(item.subtotal || 0),
        })),
      })),
    };
  }

  async markAsDelivering(orderId: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: safeUserSelect } },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatusEnum.DELIVERING,
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
    logger.info('[Order] 배달 중 상태 변경 (웹 조회로 대체)', { orderId: updatedOrder.id });

    return updatedOrder as any;
  }

  async markAsCompleted(orderId: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: safeUserSelect } },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatusEnum.COMPLETED,
        deliveredAt: new Date(),
      },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });

    // SMS 제거 — 고객은 웹 주문조회에서 실시간 상태 확인
    logger.info('[Order] 배달 완료 (웹 조회로 대체)', { orderId: order.id });

    return updatedOrder as any;
  }

  async getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
        driver: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
          } as any,
        },
      },
    });
  }

  async getOrdersByUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        restaurant: true,
      },
    });
  }

  async getOrdersByStatus(status: string): Promise<any[]> {
    return prisma.order.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });
  }

  async getPendingOrders() {
    return prisma.order.findMany({
      where: { status: OrderStatusEnum.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });
  }

  async getPendingConfirmationOrders() {
    return prisma.order.findMany({
      where: { status: OrderStatusEnum.PENDING_CONFIRMATION },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });
  }

  async getConfirmedOrders() {
    return prisma.order.findMany({
      where: { status: OrderStatusEnum.ORDER_CONFIRMED },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        restaurant: true,
        user: { select: safeUserSelect },
      },
    });
  }

  private async calculateDeliveryFee(
    restaurantLat: number,
    restaurantLng: number,
    customerLat: number,
    customerLng: number
  ): Promise<{ distance: number; deliveryFee: number }> {
    const { deliveryFeeService } = await import('./DeliveryFeeService');
    const result = deliveryFeeService.calculateWithCoordinates(
      restaurantLat,
      restaurantLng,
      customerLat,
      customerLng
    );

    return {
      distance: result.distance,
      deliveryFee: result.deliveryFee,
    };
  }

  // SMS 빌드 메서드 제거 — 고객 알림은 웹 주문조회(polling)로 대체

  async validateOrderItems(items: { menuId: string; quantity: number }[]) {
    const menuItems = await prisma.menu.findMany({
      where: {
        id: { in: items.map(i => i.menuId) },
        isAvailable: true,
        isActive: true,
      },
    });

    if (menuItems.length !== items.length) {
      throw new Error('Some menu items are not available');
    }

    let foodAmount = 0;
    let alcoholAmount = 0;

    const itemDetails = items.map((item) => {
      const menu = menuItems.find((m: any) => m.id === item.menuId)!;
      const itemSubtotal = menu.price * item.quantity;

      const isAlcohol = menu.category === '주류' || menu.ageRestriction === 'adult';
      if (isAlcohol) {
        alcoholAmount += itemSubtotal;
      } else {
        foodAmount += itemSubtotal;
      }

      return {
        menuId: item.menuId,
        menuName: menu.name,
        category: menu.category,
        ageRestriction: menu.ageRestriction,
        quantity: item.quantity,
        unitPrice: menu.price,
        subtotal: itemSubtotal,
        isAlcohol,
      };
    });

    const needsAgeVerification = menuItems.some(
      (item: any) => item.requiresAgeVerification || item.ageRestriction !== 'none'
    );

    const hasAlcoholViolation = alcoholAmount > 0 && foodAmount > 0 && alcoholAmount > foodAmount;

    return {
      isValid: !hasAlcoholViolation,
      foodAmount,
      alcoholAmount,
      needsAgeVerification,
      hasAlcoholViolation,
      items: itemDetails,
      warning: hasAlcoholViolation
        ? '관계 법령의 규정에 따라 배달 주류 구매 총액은 음식 구매액보다 적어야 합니다. 주류 주문을 줄이거나 음식 주문액을 늘려주세요.'
        : null,
    };
  }
}

export const orderService = OrderService.getInstance();
