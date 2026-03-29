export const OrderStatus = {
  PENDING: 'pending',
  PENDING_CONFIRMATION: 'pending_confirmation',
  ORDER_CONFIRMED: 'order_confirmed',
  PICKED_UP: 'picked_up',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const OrderStatusEnum = {
  PENDING: 'pending',
  PENDING_CONFIRMATION: 'pending_confirmation',
  ORDER_CONFIRMED: 'order_confirmed',
  PICKED_UP: 'picked_up',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatusEnum = typeof OrderStatusEnum[keyof typeof OrderStatusEnum];

export const PaymentStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export interface User {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  password: string | null;
  fcmToken: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Restaurant {
  id: string;
  naverPlaceId: string | null;
  kakaoPlaceId?: string | null;
  name: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  category: string | null;
  businessStatus: string | null;
  businessHours?: string | null;
  description?: string | null;
  imageUrl: string | null;
  rating: number | null;
  isActive: boolean;
  isDeliverable: boolean;
  deliveryRadius: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Menu {
  id: string;
  restaurantId: string;
  naverMenuId: string | null;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  restaurantId: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  estimatedPickupTime: Date | null;
  estimatedDeliveryTime: number | null;
  paymentMethod: string | null;
  customerPaymentId: string | null;
  customerPaidAt: Date | null;
  paymentStatus: PaymentStatus;
  restaurantPaidAmount: number | null;
  restaurantPaidAt: Date | null;
  pickupTime: Date | null;
  confirmToken: string | null;
  confirmTokenExpiry: Date | null;
  confirmedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  customerMemo: string | null;
  restaurantMemo: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
  user?: User;
  restaurant?: Restaurant;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuId: string | null;
  menuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: Date;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
