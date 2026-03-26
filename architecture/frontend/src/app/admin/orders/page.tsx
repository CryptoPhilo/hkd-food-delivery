'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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
  restaurantMemo: string | null;
  customerPaidAt: string | null;
  restaurantPaidAmount: number | null;
  restaurantPaidAt: string | null;
  createdAt: string;
  user: {
    phone: string;
    name: string | null;
  };
  restaurant: {
    name: string;
    phone: string | null;
    address: string;
  };
  items: OrderItem[];
}

const STATUS_TABS = [
  { key: 'pending', label: '신규 주문', color: 'yellow' },
  { key: 'pending_confirmation', label: '확인 대기', color: 'blue' },
  { key: 'order_confirmed', label: '확정', color: 'green' },
  { key: 'picked_up', label: '픽업 완료', color: 'purple' },
  { key: 'delivering', label: '배달 중', color: 'indigo' },
  { key: 'completed', label: '완료', color: 'gray' },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get('status') || 'pending';
  
  const [activeTab, setActiveTab] = useState(initialStatus);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupAmount, setPickupAmount] = useState('');
  const [showPickupTimeModal, setShowPickupTimeModal] = useState(false);
  const [pickupTime, setPickupTime] = useState('');
  const [restaurantMemo, setRestaurantMemo] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/orders?status=${activeTab}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && status !== activeTab) {
      setActiveTab(status);
    }
  }, [searchParams]);

  const handleTabChange = (status: string) => {
    setActiveTab(status);
    router.push(`/admin/orders?status=${status}`);
  };

  const handleSetPickupTime = async () => {
    if (!selectedOrder || !pickupTime) return;
    
    try {
      const response = await fetch(`/api/v1/orders/${selectedOrder.id}/pickup-time`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupTime: new Date(pickupTime).toISOString(),
          restaurantMemo,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('픽업 가능 시간이 설정되었습니다');
        setShowPickupTimeModal(false);
        fetchOrders();
      } else {
        alert('오류: ' + data.error);
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const handlePickupComplete = async () => {
    if (!selectedOrder) return;
    
    try {
      const response = await fetch(`/api/v1/orders/${selectedOrder.id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantPaidAmount: parseInt(pickupAmount) || selectedOrder.subtotal,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert('픽업이 완료되었습니다');
        setShowPickupModal(false);
        fetchOrders();
      } else {
        alert('오류: ' + data.error);
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/delivering`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/complete`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        fetchOrders();
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      yellow: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      green: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
    };
    return colors[color] || colors.gray;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
        <span className="text-sm text-gray-500">5초마다 자동 새로고침</span>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const colorClasses = getColorClasses(tab.color);
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? `${colorClasses.border} ${colorClasses.text}`
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              해당 상태의 주문이 없습니다
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
                isSelected={selectedOrder?.id === order.id}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          {selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              onSetPickupTime={() => {
                setPickupTime('');
                setRestaurantMemo('');
                setShowPickupTimeModal(true);
              }}
              onPickupComplete={() => {
                setPickupAmount(String(selectedOrder.subtotal));
                setShowPickupModal(true);
              }}
              onStartDelivery={() => handleStartDelivery(selectedOrder.id)}
              onCompleteDelivery={() => handleCompleteDelivery(selectedOrder.id)}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              주문을 선택하세요
            </div>
          )}
        </div>
      </div>

      {showPickupTimeModal && (
        <Modal onClose={() => setShowPickupTimeModal(false)}>
          <h3 className="text-lg font-medium mb-4">픽업 시간 설정</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                픽업 가능 시간
              </label>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                식당 메모 (선택)
              </label>
              <textarea
                value={restaurantMemo}
                onChange={(e) => setRestaurantMemo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPickupTimeModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSetPickupTime}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                설정 및 SMS 발송
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPickupModal && (
        <Modal onClose={() => setShowPickupModal(false)}>
          <h3 className="text-lg font-medium mb-4">픽업 완료 처리</h3>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ 실물 카드로 결제 후 픽업 완료를 눌러주세요
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                식당에 지불한 금액
              </label>
              <input
                type="number"
                value={pickupAmount}
                onChange={(e) => setPickupAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder={String(selectedOrder?.subtotal)}
              />
              <p className="text-sm text-gray-500 mt-1">
               菜品金额: {selectedOrder?.subtotal.toLocaleString()}원
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPickupModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handlePickupComplete}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                픽업 완료
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OrderCard({ 
  order, 
  onSelect, 
  isSelected 
}: { 
  order: Order; 
  onSelect: () => void;
  isSelected: boolean;
}) {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">{order.orderNumber}</p>
          <p className="text-sm text-gray-500">{order.restaurant.name}</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-gray-900">{order.totalAmount.toLocaleString()}원</p>
          <p className="text-sm text-gray-500">{formatTime(order.createdAt)}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {order.items.map(i => `${i.menuName} x${i.quantity}`).join(', ')}
        </span>
      </div>
      {order.estimatedDeliveryTime && (
        <div className="mt-2 text-sm text-blue-600">
          예상 배달 시간: 약 {order.estimatedDeliveryTime}분
        </div>
      )}
    </div>
  );
}

function OrderDetail({ 
  order,
  onSetPickupTime,
  onPickupComplete,
  onStartDelivery,
  onCompleteDelivery,
}: { 
  order: Order;
  onSetPickupTime: () => void;
  onPickupComplete: () => void;
  onStartDelivery: () => void;
  onCompleteDelivery: () => void;
}) {
  const getActionButton = () => {
    switch (order.status) {
      case 'pending':
        return (
          <button
            onClick={onSetPickupTime}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            픽업 시간 설정
          </button>
        );
      case 'pending_confirmation':
        return (
          <div className="space-y-2">
            <p className="text-sm text-yellow-600 text-center">
              고객 확정을 기다리는 중...
            </p>
            <button
              onClick={onSetPickupTime}
              className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              픽업 시간 재설정
            </button>
          </div>
        );
      case 'order_confirmed':
        return (
          <button
            onClick={onPickupComplete}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
          >
            픽업 완료 (실물 카드 결제)
          </button>
        );
      case 'picked_up':
        return (
          <button
            onClick={onStartDelivery}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700"
          >
            배달 시작
          </button>
        );
      case 'delivering':
        return (
          <button
            onClick={onCompleteDelivery}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
          >
            배달 완료
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sticky top-4">
      <h3 className="font-medium text-lg mb-4">주문 상세</h3>
      
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">주문번호</span>
          <span className="font-medium">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">고객</span>
          <span>{order.user.name || order.user.phone}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">식당</span>
          <span>{order.restaurant.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">배달 주소</span>
          <span className="text-right">{order.deliveryAddress}</span>
        </div>
        
        <div className="border-t pt-3">
          <p className="text-gray-500 mb-2">주문 메뉴</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-xs">
              <span>{item.menuName} x{item.quantity}</span>
              <span>{item.subtotal.toLocaleString()}원</span>
            </div>
          ))}
        </div>
        
        <div className="border-t pt-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">菜品金额</span>
            <span>{order.subtotal.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">배달비</span>
            <span>{order.deliveryFee.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>총액</span>
            <span>{order.totalAmount.toLocaleString()}원</span>
          </div>
        </div>

        {order.customerMemo && (
          <div className="border-t pt-3">
            <p className="text-gray-500 text-xs">고객 메모</p>
            <p className="text-sm">{order.customerMemo}</p>
          </div>
        )}

        {order.restaurantMemo && (
          <div>
            <p className="text-gray-500 text-xs">식당 메모</p>
            <p className="text-sm">{order.restaurantMemo}</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        {getActionButton()}
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
