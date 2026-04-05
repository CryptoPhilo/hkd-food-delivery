'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

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
  cancelReason: string | null;
  cancelledAt: string | null;
  driverId: string | null;
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

interface Driver {
  id: string;
  name: string | null;
  phone: string;
  isOnDuty: boolean;
}

const STATUS_TABS = [
  { key: 'all', label: '전체', color: 'gray' },
  { key: 'pending', label: '신규 주문', color: 'yellow' },
  { key: 'order_confirmed', label: '배달원 배정됨', color: 'blue' },
  { key: 'picked_up', label: '픽업 완료', color: 'purple' },
  { key: 'delivering', label: '배달 중', color: 'indigo' },
  { key: 'completed', label: '배달 완료', color: 'green' },
  { key: 'cancelled', label: '취소', color: 'red' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '신규 주문',
  order_confirmed: '배달원 배정됨',
  picked_up: '픽업 완료',
  delivering: '배달 중',
  completed: '배달 완료',
  cancelled: '취소됨',
};

const NEXT_STATUS_LABELS: Record<string, string> = {
  pending: '배달원 배정',
  order_confirmed: '픽업 완료',
  picked_up: '배달 시작',
  delivering: '배달 완료',
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const { adminFetch } = useAdminAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get('status') || 'all';

  const [activeTab, setActiveTab] = useState(initialStatus);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 모달 상태
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 폼 상태
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [estimatedPickupTime, setEstimatedPickupTime] = useState('');
  const [restaurantPaidAmount, setRestaurantPaidAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch(`/api/v1/admin/orders?status=${activeTab}&_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.orders || data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchDrivers = async () => {
    try {
      const res = await adminFetch('/api/v1/admin/orders/available-drivers');
      const data = await res.json();
      if (data.success) setDrivers(data.data);
    } catch {}
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    fetchDrivers();
  }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status && status !== activeTab) {
      setActiveTab(status);
    }
  }, [searchParams]);

  const handleTabChange = (status: string) => {
    setActiveTab(status);
    setSelectedOrder(null);
    router.push(`/admin/orders?status=${status}`);
  };

  // 다음 단계로 진행
  const openAdvanceModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDriverId('');
    setEstimatedPickupTime('');
    setRestaurantPaidAmount(String(order.subtotal));
    setShowAdvanceModal(true);
  };

  const handleAdvance = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);

    let body: any = { action: 'advance' };
    switch (selectedOrder.status) {
      case 'pending':
        if (!selectedDriverId) { alert('배달원을 선택해주세요'); setActionLoading(false); return; }
        body.driverId = selectedDriverId;
        break;
      case 'order_confirmed':
        if (!estimatedPickupTime) { alert('픽업 예정 시간을 입력해주세요'); setActionLoading(false); return; }
        if (!restaurantPaidAmount) { alert('식당 결제 금액을 입력해주세요'); setActionLoading(false); return; }
        body.estimatedPickupTime = new Date(estimatedPickupTime).toISOString();
        body.restaurantPaidAmount = parseInt(restaurantPaidAmount);
        break;
      case 'picked_up':
        body.pickupConfirmation = true;
        break;
      case 'delivering':
        body.deliveryConfirmation = true;
        break;
    }

    try {
      const res = await adminFetch(`/api/v1/admin/orders/${selectedOrder.id}/advance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowAdvanceModal(false);
        setSelectedOrder(null);
        await fetchOrders();
      } else {
        alert(data.error || '처리 실패');
      }
    } catch {
      alert('오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  // 취소
  const openCancelModal = (order: Order) => {
    setSelectedOrder(order);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) { alert('취소 사유를 입력해주세요'); return; }
    setActionLoading(true);

    try {
      const res = await adminFetch(`/api/v1/admin/orders/${selectedOrder.id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: cancelReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCancelModal(false);
        setSelectedOrder(null);
        await fetchOrders();
      } else {
        alert(data.error || '취소 실패');
      }
    } catch {
      alert('오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  // 삭제
  const openDeleteModal = (order: Order) => {
    setSelectedOrder(order);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;
    if (!deleteReason.trim()) { alert('삭제 사유를 입력해주세요'); return; }
    setActionLoading(true);

    try {
      const res = await adminFetch(`/api/v1/admin/orders/${selectedOrder.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setShowDeleteModal(false);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert(data.error || '삭제 실패');
      }
    } catch {
      alert('오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      order_confirmed: 'bg-blue-100 text-blue-800',
      picked_up: 'bg-purple-100 text-purple-800',
      delivering: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    );
  };

  const canAdvance = (status: string) => ['pending', 'order_confirmed', 'picked_up', 'delivering'].includes(status);
  const canCancel = (status: string) => !['completed', 'cancelled'].includes(status);

  // 진행 모달 내 폼 렌더링
  const renderAdvanceForm = () => {
    if (!selectedOrder) return null;
    switch (selectedOrder.status) {
      case 'pending':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">배달원 선택 *</label>
            <select
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">-- 배달원 선택 --</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name || d.phone} ({d.phone}) {d.isOnDuty ? '근무중' : '비번'}
                </option>
              ))}
            </select>
          </div>
        );
      case 'order_confirmed':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">픽업 예정 시간 *</label>
              <input
                type="datetime-local"
                value={estimatedPickupTime}
                onChange={e => setEstimatedPickupTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">식당 결제 금액 *</label>
              <input
                type="number"
                value={restaurantPaidAmount}
                onChange={e => setRestaurantPaidAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder={String(selectedOrder.subtotal)}
              />
              <p className="text-xs text-gray-400 mt-1">음식 금액: {selectedOrder.subtotal.toLocaleString()}원</p>
            </div>
          </div>
        );
      case 'picked_up':
        return (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm text-indigo-800">
              음식 픽업이 완료되었으면 확인 버튼을 눌러 배달을 시작하세요.
            </p>
          </div>
        );
      case 'delivering':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              고객에게 배달이 완료되었으면 확인 버튼을 눌러 배달을 완료하세요.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
        <span className="text-sm text-gray-500">10초마다 자동 새로고침</span>
      </div>

      {/* 상태 탭 */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tab.key === 'all' ? orders.length : orders.filter(o => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && !loading && (
                  <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">{orders.length}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 주문 목록 (2열: 리스트 + 상세) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              해당 상태의 주문이 없습니다
            </div>
          ) : (
            orders.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                  selectedOrder?.id === order.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{order.restaurant.name}</p>
                    <p className="text-xs text-gray-400">{order.user.name || order.user.phone} | {order.deliveryAddress}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{order.totalAmount.toLocaleString()}원</p>
                    <p className="text-xs text-gray-500">{formatTime(order.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {(order.items || []).map(i => `${i.menuName} x${i.quantity}`).join(', ')}
                </div>
                {order.customerMemo && (
                  <div className="mt-1 text-xs text-orange-600">메모: {order.customerMemo}</div>
                )}
                {order.cancelReason && (
                  <div className="mt-1 text-xs text-red-600">취소 사유: {order.cancelReason}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 상세 패널 */}
        <div className="lg:col-span-1">
          {selectedOrder ? (
            <div className="bg-white rounded-lg shadow p-5 sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-lg">주문 상세</h3>
                {getStatusBadge(selectedOrder.status)}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">주문번호</span><span className="font-medium">{selectedOrder.orderNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">고객</span><span>{selectedOrder.user.name || selectedOrder.user.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">전화번호</span><span>{selectedOrder.user.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">식당</span><span>{selectedOrder.restaurant.name}</span></div>
                <div className="flex justify-between items-start"><span className="text-gray-500">배달 주소</span><span className="text-right max-w-[60%]">{selectedOrder.deliveryAddress}</span></div>
                {selectedOrder.driverId && (
                  <div className="flex justify-between"><span className="text-gray-500">배달원</span><span>{selectedOrder.driverId}</span></div>
                )}

                <div className="border-t pt-3">
                  <p className="text-gray-500 mb-2">주문 메뉴</p>
                  {(selectedOrder.items || []).map(item => (
                    <div key={item.id} className="flex justify-between text-xs mb-1">
                      <span>{item.menuName} x{item.quantity}</span>
                      <span>{item.subtotal.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">음식 금액</span><span>{selectedOrder.subtotal.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">배달비</span><span>{selectedOrder.deliveryFee.toLocaleString()}원</span></div>
                  <div className="flex justify-between font-medium"><span>총액</span><span>{selectedOrder.totalAmount.toLocaleString()}원</span></div>
                </div>

                {selectedOrder.customerMemo && (
                  <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs">고객 메모</p>
                    <p className="text-sm">{selectedOrder.customerMemo}</p>
                  </div>
                )}

                {selectedOrder.cancelReason && (
                  <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs">취소 사유</p>
                    <p className="text-sm text-red-600">{selectedOrder.cancelReason}</p>
                    {selectedOrder.cancelledAt && <p className="text-xs text-gray-400">{formatTime(selectedOrder.cancelledAt)}</p>}
                  </div>
                )}

                {selectedOrder.restaurantPaidAmount != null && (
                  <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs">식당 결제</p>
                    <p className="text-sm">{selectedOrder.restaurantPaidAmount.toLocaleString()}원 {selectedOrder.restaurantPaidAt && `(${formatTime(selectedOrder.restaurantPaidAt)})`}</p>
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="mt-5 pt-4 border-t space-y-2">
                {canAdvance(selectedOrder.status) && (
                  <button
                    onClick={() => openAdvanceModal(selectedOrder)}
                    className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 font-medium text-sm"
                  >
                    다음 단계로 진행 → {NEXT_STATUS_LABELS[selectedOrder.status]}
                  </button>
                )}
                {canCancel(selectedOrder.status) && (
                  <button
                    onClick={() => openCancelModal(selectedOrder)}
                    className="w-full bg-red-50 text-red-600 py-2 px-4 rounded-lg hover:bg-red-100 text-sm border border-red-200"
                  >
                    주문 취소
                  </button>
                )}
                <button
                  onClick={() => openDeleteModal(selectedOrder)}
                  className="w-full bg-gray-50 text-gray-500 py-2 px-4 rounded-lg hover:bg-gray-100 text-sm border border-gray-200"
                >
                  주문 삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              주문을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 다음 단계 진행 모달 */}
      {showAdvanceModal && selectedOrder && (
        <Modal onClose={() => setShowAdvanceModal(false)}>
          <h3 className="text-lg font-medium mb-1">다음 단계로 진행</h3>
          <p className="text-sm text-gray-500 mb-4">
            {STATUS_LABELS[selectedOrder.status]} → {NEXT_STATUS_LABELS[selectedOrder.status]}
          </p>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <p><span className="text-gray-500">주문:</span> {selectedOrder.orderNumber}</p>
            <p><span className="text-gray-500">식당:</span> {selectedOrder.restaurant.name}</p>
            <p><span className="text-gray-500">고객:</span> {selectedOrder.user.name || selectedOrder.user.phone}</p>
          </div>
          {renderAdvanceForm()}
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setShowAdvanceModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleAdvance} disabled={actionLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {actionLoading ? '처리 중...' : '확인'}
            </button>
          </div>
        </Modal>
      )}

      {/* 취소 모달 */}
      {showCancelModal && selectedOrder && (
        <Modal onClose={() => setShowCancelModal(false)}>
          <h3 className="text-lg font-medium mb-4 text-red-600">주문 취소</h3>
          <div className="bg-red-50 rounded-lg p-3 mb-4 text-sm">
            <p><span className="text-gray-500">주문:</span> {selectedOrder.orderNumber}</p>
            <p><span className="text-gray-500">고객:</span> {selectedOrder.user.name || selectedOrder.user.phone}</p>
            <p><span className="text-gray-500">금액:</span> {selectedOrder.totalAmount.toLocaleString()}원</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">취소 사유 *</label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
              placeholder="취소 사유를 입력해주세요"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">돌아가기</button>
            <button onClick={handleCancel} disabled={actionLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              {actionLoading ? '처리 중...' : '취소 확정'}
            </button>
          </div>
        </Modal>
      )}

      {/* 삭제 모달 */}
      {showDeleteModal && selectedOrder && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <h3 className="text-lg font-medium mb-4 text-gray-900">주문 삭제</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 font-medium">이 작업은 되돌릴 수 없습니다.</p>
            <p className="text-xs text-yellow-700 mt-1">주문 데이터가 완전히 삭제됩니다.</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
            <p><span className="text-gray-500">주문:</span> {selectedOrder.orderNumber}</p>
            <p><span className="text-gray-500">상태:</span> {STATUS_LABELS[selectedOrder.status]}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">삭제 사유 *</label>
            <textarea
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
              placeholder="삭제 사유를 입력해주세요"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">돌아가기</button>
            <button onClick={handleDelete} disabled={actionLoading} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50">
              {actionLoading ? '처리 중...' : '삭제 확정'}
            </button>
          </div>
        </Modal>
      )}
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
