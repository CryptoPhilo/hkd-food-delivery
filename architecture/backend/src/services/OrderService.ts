import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { paymentService } from './PaymentService';
import { smsService } from './SMSService';
import { ageVerificationService } from './AgeVerificationService';
import { OrderStatus, PaymentStatus, User, Restaurant, Order, OrderItem } from '../types/prisma';

const prisma = new PrismaClient();

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
    const { userId, restaurantId, items, deliveryAddress, deliveryLat, deliveryLng, customerMemo, ageVerificationId } = input;

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

    const { deliveryFee, distance } = await this.calculateDeliveryFee(
      restaurant.latitude,
      restaurant.longitude,
      deliveryLat,
      deliveryLng
    );

    if (restaurant.deliveryRadius && distance > restaurant.deliveryRadius) {
      throw new Error(`배달 가능 지역을 초과했습니다. (최대 ${restaurant.deliveryRadius}km)`);
    }

    const totalAmount = subtotal + deliveryFee;
    const estimatedDeliveryTime = Math.ceil(20 + (distance / 30) * 60);
    const orderNumber = `HK${Date.now().toString(36).toUpperCase()}`;

    const order = await prisma.order.create({
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
        items: {
          create: orderItemData,
        },
      },
      include: {
        items: true,
        restaurant: true,
        user: true,
      },
    });

    const message = this.buildOrderReceivedSMS(order, distance, estimatedDeliveryTime);
    await smsService.sendSMS({
      to: order.user.phone,
      message,
    });

    return order as any;
  }

  async setPickupTime(input: SetPickupTimeInput): Promise<Order> {
    const { orderId, pickupTime, restaurantMemo } = input;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, restaurant: true, items: true },
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
        user: true,
      },
    });

    const confirmUrl = `${process.env.FRONTEND_URL}/confirm/${confirmToken}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/cancel/${confirmToken}`;

    const smsMessage = this.buildConfirmationSMS(updatedOrder, pickupTime, confirmUrl, cancelUrl);
    await smsService.sendSMS({
      to: updatedOrder.user.phone,
      message: smsMessage,
    });

    return updatedOrder as any;
  }

  async confirmOrder(token: string): Promise<Order> {
    const order = await prisma.order.findFirst({
      where: {
        confirmToken: token,
        status: OrderStatusEnum.PENDING_CONFIRMATION,
      },
      include: { user: true, restaurant: true, items: true },
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
        user: true,
      },
    });

    const message = this.buildConfirmedSMS(updatedOrder);
    await smsService.sendSMS({
      to: updatedOrder.user.phone,
      message,
    });

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
        user: true,
      },
    });

    const message = this.buildCancellationSMS(updatedOrder);
    await smsService.sendSMS({
      to: updatedOrder.user.phone,
      message,
    });

    return updatedOrder as any;
  }

  async markAsPickedUp(orderId: string, restaurantPaidAmount?: number): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, restaurant: true, items: true },
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
        user: true,
      },
    });

    const message = this.buildPickedUpSMS(updatedOrder);
    await smsService.sendSMS({
      to: updatedOrder.user.phone,
      message: message,
    });

    return updatedOrder as any;
  }

  async markAsDelivering(orderId: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
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
        user: true,
      },
    });

    await smsService.sendSMS({
      to: updatedOrder.user.phone,
      message: `[한경배달] 주문번호 ${order.orderNumber}이(가) 배달 중입니다.`,
    });

    return updatedOrder as any;
  }

  async markAsCompleted(orderId: string): Promise<Order> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
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
        user: true,
      },
    });

    await smsService.sendDeliveryComplete(order.user.phone, order.orderNumber);

    return updatedOrder as any;
  }

  async getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        restaurant: true,
        user: true,
        driver: true,
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
        user: true,
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
        user: true,
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
        user: true,
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
        user: true,
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

  private buildOrderReceivedSMS(order: any, distance: number, estimatedTime: number): string {
    const items = (order.items || []).map((i: any) => `${i.menuName} x${i.quantity}`).join(', ');

    return `[한경배달]
주문이 요청되었습니다.
주문번호: ${order.orderNumber}
식당: ${order.restaurant.name}
메뉴: ${items}
배달비: ${order.deliveryFee.toLocaleString()}원
총액: ${order.totalAmount.toLocaleString()}원
예상 배달 시간: 약 ${estimatedTime}분

업체에서 픽업 가능 시간을 확인중입니다.`;
  }

  private buildConfirmationSMS(
    order: any,
    pickupTime: Date,
    confirmUrl: string,
    cancelUrl: string
  ): string {
    const pickupTimeStr = pickupTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const items = (order.items || []).map((i: any) => `${i.menuName} x${i.quantity}`).join(', ');

    return `[한경배달]
주문번호: ${order.orderNumber}
식당: ${order.restaurant.name}
메뉴: ${items}
배달비: ${order.deliveryFee.toLocaleString()}원
총액: ${order.totalAmount.toLocaleString()}원
예상 픽업 시간: ${pickupTimeStr}
예상 배달 시간: 약 ${order.estimatedDeliveryTime}분

주문을 확정하시겠습니까?
확정: ${confirmUrl}
취소: ${cancelUrl}

10분 이내 미확정 시 자동 취소됩니다.`;
  }

  private buildConfirmedSMS(order: any): string {
    return `[한경배달]
주문번호: ${order.orderNumber}이(가) 확정되었습니다.
업체에서 식당에 주문을 넣고 픽업 후 배달을 시작합니다.`;
  }

  private buildCancellationSMS(order: any): string {
    return `[한경배달]
주문번호: ${order.orderNumber}이(가) 취소되었습니다.`;
  }

  private buildPickedUpSMS(order: any): string {
    return `[한경배달]
주문번호: ${order.orderNumber}의 결제가 완료되고 픽업되었습니다.
배달을 시작합니다.`;
  }

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
