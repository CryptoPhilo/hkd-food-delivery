'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import PhoneInput from '@/components/PhoneInput';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/utils/auth';

interface OrderItem {
  id: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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
  createdAt: string;
  deliveryGroupId: string | null;
  restaurant: {
    name: string;
    phone: string | null;
  };
  items: OrderItem[];
}

interface DeliveryGroup {
  id: string;
  deliveryAddress: string;
  createdAt: string;
  orders: Order[];
  totalAmount: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'airbnb-badge bg-airbnb-yellow-bg text-airbnb-yellow-text',
  pending_confirmation: 'airbnb-badge bg-airbnb-blue-bg text-airbnb-blue-text',
  order_confirmed: 'airbnb-badge bg-airbnb-green-bg text-airbnb-green',
  picked_up: 'airbnb-badge bg-airbnb-purple-bg text-airbnb-purple-text',
  delivering: 'airbnb-badge bg-airbnb-blue-bg text-airbnb-blue-text',
  completed: 'airbnb-badge bg-airbnb-surface text-airbnb-gray',
  cancelled: 'airbnb-badge bg-red-50 text-airbnb-red',
};

// 고객에게 보이는 진행 단계 (pending_confirmation은 pending과 동일하게 취급)
const STATUS_STEPS = ['pending', 'order_confirmed', 'picked_up', 'delivering', 'completed'];

/**
 * DB에 잘못된 상태값이 저장된 레거시 주문을 정규화
 * (admin.routes.ts의 STATUS_TRANSITIONS 불일치로 인해 발생)
 */
function normalizeStatus(status: string): string {
  const LEGACY_STATUS_MAP: Record<string, string> = {
    confirmed: 'order_confirmed',
    picking_up: 'picked_up',
    delivered: 'completed',
    pending_confirmation: 'pending', // 고객에겐 pending과 동일하게 보임
  };
  return LEGACY_STATUS_MAP[status] || status;
}

export default function MyOrdersPage() {
  const t = useTranslations();
  const { isAuthenticated, user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryGroups, setDeliveryGroups] = useState<DeliveryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DeliveryGroup | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

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

  const groupOrdersByDelivery = (orders: Order[]): DeliveryGroup[] => {
    const groups: Map<string, DeliveryGroup> = new Map();

    for (const order of orders) {
      // 레거시 상태값 정규화
      const normalizedStatus = normalizeStatus(order.status);
      const normalizedOrder = { ...order, status: normalizedStatus };

      // deliveryGroupId가 있으면 해당 ID로 그룹핑, 없으면 주문 자체를 하나의 그룹으로
      const groupKey = order.deliveryGroupId || `single_${order.id}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          deliveryAddress: order.deliveryAddress,
          createdAt: order.createdAt,
          orders: [],
          totalAmount: 0,
          status: normalizedStatus,
        });
      }

      const group = groups.get(groupKey)!;
      group.orders.push(normalizedOrder);
      group.totalAmount += order.totalAmount;

      // 가장 느린(최소 진행) 상태를 그룹 상태로 사용
      const statusPriority = STATUS_STEPS.indexOf(normalizedStatus);
      const currentPriority = STATUS_STEPS.indexOf(group.status);
      if (statusPriority >= 0 && (currentPriority < 0 || statusPriority < currentPriority)) {
        group.status = normalizedStatus;
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const fetchOrders = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) {
        params.append('date', date);
      }
      const response = await fetchWithAuth(`/api/v1/orders?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
        setDeliveryGroups(groupOrdersByDelivery(data.data));
        setSearched(true);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // localStorage에서 전화번호 자동 로드 + 즉시 조회
  useEffect(() => {
    const savedPhone = localStorage.getItem('hkd_phone');
    if (savedPhone && !autoLoaded) {
      setPhone(savedPhone);
      setAutoLoaded(true);
    }
  }, []);

  // 전화번호 또는 날짜 변경 시 자동 조회
  useEffect(() => {
    if (phone) {
      fetchOrders();
    }
  }, [date, autoLoaded]);

  // 진행 중인 주문이 있으면 15초마다 자동 새로고침
  useEffect(() => {
    const hasActiveOrder = deliveryGroups.some(
      g => !['completed', 'cancelled'].includes(g.status)
    );
    if (!hasActiveOrder || !phone) return;

    const interval = setInterval(() => {
      fetchOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, [deliveryGroups, phone]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusStep = (status: string) => {
    return STATUS_STEPS.indexOf(status);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-airbnb-divider sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="airbnb-circle-btn w-9 h-9 flex items-center justify-center">
              <svg className="w-6 h-6 text-airbnb-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-airbnb-black tracking-airbnb-tight">{t('myOrders.title')}</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        <div className="airbnb-card bg-white rounded-airbnb-lg p-4 mb-4 overflow-hidden">
          {autoLoaded && phone ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-airbnb-gray">{phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3')}</span>
                {loading && (
                  <div className="w-4 h-4 border-2 border-airbnb-red border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <button
                onClick={() => { setAutoLoaded(false); setPhone(''); setSearched(false); setDeliveryGroups([]); }}
                className="text-sm text-airbnb-gray underline"
              >
                {t('myOrders.changePhone') || '다른 번호로 조회'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <PhoneInput
                value={phone}
                onChange={(e164) => setPhone(e164)}
                className="w-full"
              />
              <button
                onClick={() => { if (phone) { localStorage.setItem('hkd_phone', phone.replace(/-/g, '')); setAutoLoaded(true); } }}
                disabled={loading || !phone}
                className="airbnb-btn-primary w-full py-3 bg-airbnb-black text-white rounded-airbnb-sm disabled:bg-airbnb-disabled font-medium"
              >
                {loading ? t('myOrders.querying') : t('myOrders.query')}
              </button>
            </div>
          )}
          <div className="flex items-center space-x-2 mt-3">
            <label className="text-sm text-airbnb-gray">{t('myOrders.orderDate')}:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-airbnb-border rounded-airbnb-sm px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => setDate(today)}
              className={`px-3 py-1.5 text-sm rounded-airbnb-xl ${
                date === today
                  ? 'bg-airbnb-red text-white'
                  : 'bg-airbnb-surface text-airbnb-gray hover:bg-airbnb-divider'
              }`}
            >
              {t('myOrders.today')}
            </button>
          </div>
        </div>

        {searched && deliveryGroups.length === 0 && (
          <div className="airbnb-card bg-white rounded-airbnb-lg p-8 text-center text-airbnb-gray">
            {t('myOrders.noOrders')}
          </div>
        )}

        {deliveryGroups.length > 0 && (
          <div className="space-y-4">
            {deliveryGroups.map((group) => (
              <div
                key={group.id}
                className="airbnb-card bg-white rounded-airbnb-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[group.status]}`}>
                          {getStatusLabel(group.status)}
                        </span>
                      </div>
                      <p className="font-medium text-airbnb-black mt-1.5">
                        {group.orders.length === 1
                          ? group.orders[0].restaurant.name
                          : `${group.orders[0].restaurant.name} ${t('myOrders.andMore', { n: group.orders.length - 1 }) || `외 ${group.orders.length - 1}건`}`
                        }
                      </p>
                      <p className="text-sm text-airbnb-gray mt-1">{group.deliveryAddress}</p>
                      <p className="text-xs text-airbnb-gray">{formatDate(group.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-airbnb-black">₩{group.totalAmount.toLocaleString()}</p>
                      <svg
                        className={`w-5 h-5 text-airbnb-gray mt-1 transition-transform ${selectedGroup?.id === group.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      {STATUS_STEPS.slice(0, -1).map((step, index) => (
                        <div key={step} className="flex items-center">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              getStatusStep(group.status) >= index
                                ? 'bg-airbnb-red'
                                : 'bg-airbnb-surface'
                            }`}
                          />
                          {index < STATUS_STEPS.length - 2 && (
                            <div
                              className={`w-8 h-0.5 mx-1 ${
                                getStatusStep(group.status) > index
                                  ? 'bg-airbnb-red'
                                  : 'bg-airbnb-surface'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-airbnb-gray">{t('myOrders.statusOrder')}</span>
                      <span className="text-xs text-airbnb-gray">{t('myOrders.statusConfirm')}</span>
                      <span className="text-xs text-airbnb-gray">{t('myOrders.statusPickup')}</span>
                      <span className="text-xs text-airbnb-gray">{t('myOrders.statusDelivery')}</span>
                    </div>
                  </div>
                </div>

                {selectedGroup?.id === group.id && (
                  <div className="border-t border-airbnb-divider">
                    {group.orders.map((order) => (
                      <div key={order.id} className="p-4 border-b border-airbnb-divider last:border-b-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-airbnb-black">{order.restaurant.name}</span>
                          <span className="text-sm text-airbnb-gray">#{order.orderNumber}</span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-airbnb-gray">
                                {item.menuName} x{item.quantity}
                              </span>
                              <span className="text-airbnb-gray">₩{item.subtotal.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t border-airbnb-divider text-sm font-medium text-airbnb-black">
                          <span>{t('common.subtotal')}</span>
                          <span>₩{order.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
