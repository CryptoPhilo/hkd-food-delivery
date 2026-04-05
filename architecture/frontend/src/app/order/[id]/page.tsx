'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { fetchWithAuth } from '@/utils/auth';

interface OrderItem {
  id: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface DeliveryGroupOrderItem {
  id: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface DeliveryGroupOrder {
  id: string;
  orderNumber: string;
  restaurantName: string;
  status: string;
  pickedUpAt: string | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  items: DeliveryGroupOrderItem[];
}

interface DeliveryGroup {
  totalOrders: number;
  pickedUpOrders: number;
  groupSubtotal: number;
  groupDeliveryFee: number;
  groupTotalAmount: number;
  orders: DeliveryGroupOrder[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: string;
  estimatedPickupTime: string | null;
  estimatedDeliveryTime: number | null;
  customerMemo: string | null;
  restaurantMemo: string | null;
  createdAt: string;
  deliveryGroupId: string | null;
  deliveryGroup: DeliveryGroup | null;
  user: {
    phone: string;
    name: string | null;
  };
  restaurant: {
    name: string;
    phone: string | null;
  };
  driver?: {
    id: string;
    phone: string;
    name: string | null;
  } | null;
  items: OrderItem[];
}


const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-airbnb-yellow-bg text-airbnb-yellow-text',
  pending_confirmation: 'bg-airbnb-blue-bg text-airbnb-blue-text',
  order_confirmed: 'bg-airbnb-green-bg text-airbnb-green',
  picked_up: 'bg-airbnb-purple-bg text-airbnb-purple-text',
  delivering: 'bg-airbnb-blue-bg text-airbnb-blue-text',
  completed: 'bg-airbnb-surface text-airbnb-black',
  cancelled: 'bg-airbnb-red text-white',
};

/**
 * DB에 잘못된 상태값이 저장된 레거시 주문을 정규화
 */
function normalizeStatus(status: string): string {
  const LEGACY_STATUS_MAP: Record<string, string> = {
    confirmed: 'order_confirmed',
    picking_up: 'picked_up',
    delivered: 'completed',
  };
  return LEGACY_STATUS_MAP[status] || status;
}

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params.id as string;
  const t = useTranslations();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetchWithAuth(`/api/v1/orders/${orderId}?_t=${Date.now()}`);
      const data = await response.json();
      if (data.success) {
        // 레거시 상태값 정규화
        const orderData = { ...data.data, status: normalizeStatus(data.data.status) };
        setOrder(orderData);
        setError(null);
      } else {
        setError(data.error || t('orderDetail.notFound'));
      }
    } catch (err) {
      // 네트워크 에러 시 기존 주문 데이터가 있으면 에러를 표시하지 않음
      if (!order) {
        setError(t('orderDetail.loadingOrder'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red mx-auto mb-4"></div>
          <p className="text-airbnb-gray">{t('orderDetail.loadingOrder')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-airbnb-red mb-4">{error || t('orderDetail.notFound')}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchOrder(); }}
            className="text-airbnb-red hover:underline mb-3 block mx-auto"
          >
            {t('common.retry')}
          </button>
          <Link href="/" className="text-airbnb-red hover:underline">
            {t('common.goToMain')}
          </Link>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('orderStatus.pending'),
      pending_confirmation: t('orderStatus.pendingConfirmation'),
      order_confirmed: t('orderStatus.confirmed'),
      picked_up: t('orderStatus.pickedUp'),
      delivering: t('orderStatus.delivering'),
      completed: t('orderStatus.completed'),
      cancelled: t('orderStatus.cancelled'),
    };
    return map[status] || status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-airbnb-divider">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-airbnb-black tracking-airbnb-tight">{t('orderDetail.orderStatus')}</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-airbnb-gray">{t('orderDetail.orderNumber')}</p>
              <p className="text-lg font-bold text-airbnb-black">{order.orderNumber}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium airbnb-badge ${STATUS_COLORS[order.status]}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>

          <div className="border-t border-airbnb-divider pt-4">
            <p className="text-sm text-airbnb-gray mb-1">{t('orderDetail.restaurant')}</p>
            <p className="font-medium text-airbnb-black">
              {order.deliveryGroup && order.deliveryGroup.totalOrders > 1
                ? order.deliveryGroup.orders.map(o => o.restaurantName).join(', ')
                : order.restaurant.name
              }
            </p>
          </div>

          <div className="border-t border-airbnb-divider pt-4">
            <p className="text-sm text-airbnb-gray mb-1">{t('orderDetail.deliveryAddress')}</p>
            <p className="font-medium text-airbnb-black">{order.deliveryAddress}</p>
          </div>

          {order.estimatedDeliveryTime && (
            <div className="border-t border-airbnb-divider pt-4">
              <p className="text-sm text-airbnb-gray mb-1">{t('orderDetail.estimatedTime')}</p>
              <p className="font-medium text-airbnb-red">{t('orderDetail.aboutMinutes', { minutes: order.estimatedDeliveryTime })}</p>
            </div>
          )}

          {order.driver && (
            <div className="border-t border-airbnb-divider pt-4">
              <p className="text-sm text-airbnb-gray mb-1">{t('orderDetail.driver')}</p>
              <div className="flex items-center justify-between">
                <p className="font-medium text-airbnb-black">{order.driver.name || t('orderDetail.driver')}</p>
                <a
                  href={`tel:${order.driver.phone}`}
                  className="flex items-center text-airbnb-red text-sm"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {order.driver.phone}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 복수 식당 픽업 진행률 */}
        {order.deliveryGroup && order.deliveryGroup.totalOrders > 1 && (
          <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
            <h2 className="font-semibold text-airbnb-black mb-3 tracking-airbnb-tight">{t('orderDetail.pickupProgress')}</h2>

            {/* 진행률 바 */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-airbnb-gray mb-1">
                <span>{t('orderDetail.pickupCount', { picked: order.deliveryGroup.pickedUpOrders, total: order.deliveryGroup.totalOrders })}</span>
                <span>{Math.round((order.deliveryGroup.pickedUpOrders / order.deliveryGroup.totalOrders) * 100)}%</span>
              </div>
              <div className="w-full bg-airbnb-surface rounded-full h-2.5">
                <div
                  className="bg-airbnb-red h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${(order.deliveryGroup.pickedUpOrders / order.deliveryGroup.totalOrders) * 100}%` }}
                />
              </div>
            </div>

            {/* 식당별 체크리스트 */}
            <div className="space-y-2">
              {order.deliveryGroup.orders.map((groupOrder) => {
                const isPickedUp = ['picked_up', 'delivering', 'completed'].includes(groupOrder.status);
                return (
                  <div key={groupOrder.id} className="flex items-center gap-2 text-sm">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isPickedUp ? 'bg-airbnb-green-bg text-airbnb-green' : 'bg-airbnb-surface text-airbnb-gray'
                    }`}>
                      {isPickedUp ? '✓' : '·'}
                    </span>
                    <span className={isPickedUp ? 'text-airbnb-black' : 'text-airbnb-gray'}>
                      {groupOrder.restaurantName}
                    </span>
                    <span className={`ml-auto text-xs ${isPickedUp ? 'text-airbnb-green' : 'text-airbnb-gray'}`}>
                      {isPickedUp ? t('orderDetail.pickupDone') : t('orderDetail.pickupWaiting')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
          <h2 className="font-semibold text-airbnb-black mb-3 tracking-airbnb-tight">{t('orderDetail.orderItems')}</h2>

          {order.deliveryGroup && order.deliveryGroup.totalOrders > 1 ? (
            /* 그룹 주문: 식당별로 아이템 표시 */
            <div className="space-y-4">
              {order.deliveryGroup.orders.map((groupOrder) => (
                <div key={groupOrder.id}>
                  <p className="text-sm font-medium text-airbnb-black mb-2 pb-1 border-b border-airbnb-divider">
                    {groupOrder.restaurantName}
                  </p>
                  <div className="space-y-1.5">
                    {groupOrder.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-airbnb-black">{item.menuName} x{item.quantity}</span>
                        <span className="text-airbnb-gray">₩{item.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-airbnb-divider pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-airbnb-gray">{t('checkout.foodAmount')}</span>
                  <span className="text-airbnb-black">₩{order.deliveryGroup.groupSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-airbnb-gray">{t('checkout.deliveryFee')}</span>
                  <span className="text-airbnb-black">₩{order.deliveryGroup.groupDeliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-airbnb-black">
                  <span>{t('checkout.totalAmount')}</span>
                  <span>₩{order.deliveryGroup.groupTotalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            /* 단일 식당 주문 */
            <>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-airbnb-black">
                      {item.menuName} x{item.quantity}
                    </span>
                    <span className="text-airbnb-gray">₩{item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-airbnb-divider mt-3 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-airbnb-gray">{t('checkout.foodAmount')}</span>
                  <span className="text-airbnb-black">₩{order.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-airbnb-gray">{t('checkout.deliveryFee')}</span>
                  <span className="text-airbnb-black">₩{order.deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-airbnb-black">
                  <span>{t('checkout.totalAmount')}</span>
                  <span>₩{order.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {order.customerMemo && (
          <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
            <h2 className="font-semibold text-airbnb-black mb-2 tracking-airbnb-tight">{t('orderDetail.customerMemo')}</h2>
            <p className="text-sm text-airbnb-gray">{order.customerMemo}</p>
          </div>
        )}

        {order.restaurantMemo && (
          <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
            <h2 className="font-semibold text-airbnb-black mb-2 tracking-airbnb-tight">{t('orderDetail.restaurantMemo')}</h2>
            <p className="text-sm text-airbnb-gray">{order.restaurantMemo}</p>
          </div>
        )}

        <div className="airbnb-card bg-white rounded-airbnb-lg p-4">
          <p className="text-sm text-airbnb-gray">{t('orderDetail.orderTime')}</p>
          <p className="text-sm text-airbnb-black">{formatDate(order.createdAt)}</p>
        </div>

        <Link
          href="/"
          className="block w-full text-center bg-airbnb-surface text-airbnb-black py-3 rounded-airbnb-sm font-medium hover:bg-airbnb-divider"
        >
          {t('common.backToMain')}
        </Link>
      </main>
    </div>
  );
}
