'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const STATUS_LABELS: Record<string, string> = {
  pending: '주문 요청됨',
  pending_confirmation: '확인 대기중',
  order_confirmed: '주문 확정',
  picked_up: '픽업 완료',
  delivering: '배달 중',
  completed: '배달 완료',
  cancelled: '주문 취소',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_confirmation: 'bg-blue-100 text-blue-800',
  order_confirmed: 'bg-green-100 text-green-800',
  picked_up: 'bg-purple-100 text-purple-800',
  delivering: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_STEPS = ['pending', 'pending_confirmation', 'order_confirmed', 'picked_up', 'delivering', 'completed'];

export default function MyOrdersPage() {
  const today = new Date().toISOString().split('T')[0];
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(today);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryGroups, setDeliveryGroups] = useState<DeliveryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DeliveryGroup | null>(null);

  const groupOrdersByDelivery = (orders: Order[]): DeliveryGroup[] => {
    const groups: Map<string, DeliveryGroup> = new Map();
    
    for (const order of orders) {
      const timeKey = new Date(order.createdAt).getTime();
      const timeBucket = Math.floor(timeKey / 60000);
      const groupKey = `${order.deliveryAddress}_${timeBucket}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          deliveryAddress: order.deliveryAddress,
          createdAt: order.createdAt,
          orders: [],
          totalAmount: 0,
          status: order.status,
        });
      }
      
      const group = groups.get(groupKey)!;
      group.orders.push(order);
      group.totalAmount += order.totalAmount;
      
      const statusPriority = STATUS_STEPS.indexOf(order.status);
      const currentPriority = STATUS_STEPS.indexOf(group.status);
      if (statusPriority > currentPriority) {
        group.status = order.status;
      }
    }
    
    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const fetchOrders = async () => {
    if (!phone) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({ phone });
      if (date) {
        params.append('date', date);
      }
      const response = await fetch(`/api/v1/orders?${params.toString()}`);
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

  useEffect(() => {
    if (phone) {
      fetchOrders();
    }
  }, [date]);

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="p-2 -ml-2">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-gray-900">내 주문 조회</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex space-x-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호 (010-1234-5678)"
              className="flex-1 border rounded-lg px-3 py-2"
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            />
            <button
              onClick={fetchOrders}
              disabled={loading || !phone}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            >
              {loading ? '조회중...' : '조회'}
            </button>
          </div>
          <div className="flex items-center space-x-2 mt-3">
            <label className="text-sm text-gray-600">주문일:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              onClick={() => setDate(today)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                date === today
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              오늘
            </button>
          </div>
        </div>

        {searched && deliveryGroups.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            주문 내역이 없습니다.
          </div>
        )}

        {deliveryGroups.length > 0 && (
          <div className="space-y-4">
            {deliveryGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[group.status]}`}>
                          {STATUS_LABELS[group.status]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {group.orders.length}개 식당
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{group.deliveryAddress}</p>
                      <p className="text-xs text-gray-400">{formatDate(group.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{group.totalAmount.toLocaleString()}원</p>
                      <svg
                        className={`w-5 h-5 text-gray-400 mt-1 transition-transform ${selectedGroup?.id === group.id ? 'rotate-180' : ''}`}
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
                                ? 'bg-blue-600'
                                : 'bg-gray-200'
                            }`}
                          />
                          {index < STATUS_STEPS.length - 2 && (
                            <div
                              className={`w-8 h-0.5 mx-1 ${
                                getStatusStep(group.status) > index
                                  ? 'bg-blue-600'
                                  : 'bg-gray-200'
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">주문</span>
                      <span className="text-xs text-gray-500">확정</span>
                      <span className="text-xs text-gray-500">픽업</span>
                      <span className="text-xs text-gray-500">배달</span>
                      <span className="text-xs text-gray-500">완료</span>
                    </div>
                  </div>
                </div>

                {selectedGroup?.id === group.id && (
                  <div className="border-t">
                    {group.orders.map((order) => (
                      <div key={order.id} className="p-4 border-b last:border-b-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{order.restaurant.name}</span>
                          <span className="text-sm text-gray-500">#{order.orderNumber}</span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {item.menuName} x{item.quantity}
                              </span>
                              <span className="text-gray-500">{item.subtotal.toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t text-sm font-medium">
                          <span>소계</span>
                          <span>{order.totalAmount.toLocaleString()}원</span>
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
