'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Driver {
  id: string;
  phone: string;
  name: string | null;
  cardNumber: string | null;
  isOnDuty: boolean;
  dutyStartedAt: string | null;
  totalDeliveries: number;
  totalDeliveryFee: number;
}

interface Delivery {
  id: string;
  orderNumber: string;
  status: string;
  deliveryFee: number;
  deliveryAddress: string;
  deliveredAt: string | null;
  restaurant: {
    name: string;
  };
  user: {
    phone: string;
    name: string | null;
  };
}

interface DeliverySummary {
  totalDeliveries: number;
  totalDeliveryFee: number;
}

interface PendingOrder {
  id: string;
  deliveryAddress: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  customerName: string;
  customerPhone: string;
  customerMemo: string | null;
  orders: {
    id: string;
    orderNumber: string;
    restaurantName: string;
    items: string[];
    subtotal: number;
  }[];
  totalDeliveryFee: number;
  createdAt: string;
}

interface AssignedOrder {
  id: string;
  orderNumber: string;
  status: string;
  deliveryAddress: string;
  deliveryFee: number;
  customerName: string;
  customerPhone: string;
  customerMemo: string | null;
  restaurantName: string;
  items: string[];
  createdAt: string;
}

export default function DriverPage() {
  const today = new Date().toISOString().split('T')[0];
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [summary, setSummary] = useState<DeliverySummary>({ totalDeliveries: 0, totalDeliveryFee: 0 });
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useDateRange, setUseDateRange] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loadingPending, setLoadingPending] = useState(false);
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrder[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleApiError = (error: any, defaultMessage: string) => {
    console.error(defaultMessage, error);
    if (error.message) {
      showMessage(error.message, 'error');
    } else {
      showMessage(defaultMessage, 'error');
    }
  };

  useEffect(() => {
    if (phone && phone.length >= 10) {
      fetchDriverStatus();
    }
  }, [phone]);

  useEffect(() => {
    if (driver && phone) {
      fetchDeliveries();
    }
  }, [date, startDate, endDate, useDateRange, driver]);

  useEffect(() => {
    if (driver?.isOnDuty) {
      fetchPendingOrders();
      fetchAssignedOrders();
    } else {
      setPendingOrders([]);
      setSelectedOrders(new Set());
      setAssignedOrders([]);
    }
  }, [driver?.isOnDuty]);

  const fetchDriverStatus = async () => {
    try {
      const response = await fetch(`/api/v1/drivers?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();
      if (data.success && data.data) {
        setDriver(data.data);
        setName(data.data.name || '');
        setCardNumber(data.data.cardNumber || '');
      } else {
        setDriver(null);
      }
    } catch (error) {
      handleApiError(error, '배달원 상태 조회 실패');
    }
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ phone });
      if (useDateRange && startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else {
        params.append('date', date);
      }

      const response = await fetch(`/api/v1/drivers/deliveries?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.data.deliveries);
        setSummary(data.data.summary);
      } else {
        showMessage(data.error || '배달 내역 조회 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '배달 내역 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingOrders = async () => {
    setLoadingPending(true);
    try {
      const response = await fetch('/api/v1/drivers/pending-orders');
      const data = await response.json();
      if (data.success) {
        setPendingOrders(data.data);
      } else {
        showMessage(data.error || '대기 주문 조회 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '대기 주문 조회 실패');
    } finally {
      setLoadingPending(false);
    }
  };

  const fetchAssignedOrders = async () => {
    setLoadingAssigned(true);
    try {
      const response = await fetch(`/api/v1/drivers/my-orders?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();
      if (data.success) {
        setAssignedOrders(data.data);
      } else {
        showMessage(data.error || '배정 주문 조회 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '배정 주문 조회 실패');
    } finally {
      setLoadingAssigned(false);
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    if (!confirm('배달을 완료 처리하시겠습니까?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/drivers/complete', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();
      if (data.success) {
        showMessage('배달이 완료되었습니다', 'success');
        fetchAssignedOrders();
        fetchDeliveries();
      } else {
        showMessage(data.error || '배달 완료 처리 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '배달 완료 처리 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = (groupId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === pendingOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(pendingOrders.map(o => o.id)));
    }
  };

  const handleAssignSingle = async (groupId: string) => {
    const group = pendingOrders.find(o => o.id === groupId);
    if (!group) return;

    const orderIds = group.orders.map(o => o.id);
    await assignOrders(orderIds);
  };

  const handleAssignSelected = async () => {
    const orderIds: string[] = [];
    pendingOrders
      .filter(o => selectedOrders.has(o.id))
      .forEach(group => {
        group.orders.forEach(o => orderIds.push(o.id));
      });

    if (orderIds.length === 0) {
      showMessage('선택된 주문이 없습니다', 'error');
      return;
    }

    await assignOrders(orderIds);
    setSelectedOrders(new Set());
  };

  const assignOrders = async (orderIds: string[]) => {
    if (!confirm(`${orderIds.length}개 주문을 배정하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/drivers/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, phone }),
      });

      const data = await response.json();
      if (data.success) {
        showMessage(`${orderIds.length}개 주문이 배정되었습니다`, 'success');
        fetchPendingOrders();
        fetchAssignedOrders();
      } else {
        showMessage(data.error || '배달 배정 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '배달 배정 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDuty = async () => {
    if (!phone) {
      showMessage('전화번호를 입력해주세요', 'error');
      return;
    }

    if (!/^010-\d{4}-\d{4}$/.test(phone)) {
      showMessage('올바른 전화번호 형식이 아닙니다 (010-XXXX-XXXX)', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          phone,
          name: name || null,
          cardNumber: cardNumber || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDriver(data.data);
        showMessage('업무를 개시했습니다', 'success');
      } else {
        showMessage(data.error || '업무 개시 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '업무 개시 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleEndDuty = async () => {
    if (!confirm('업무를 종료하시겠습니까?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          phone,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDriver(data.data);
        showMessage('업무를 종료했습니다', 'success');
      } else {
        showMessage(data.error || '업무 종료 실패', 'error');
      }
    } catch (error) {
      handleApiError(error, '업무 종료 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            <h1 className="text-lg font-bold text-gray-900">배달원</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">배달원 정보</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 (선택)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">구매카드 번호 (선택)</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="1234-5678-9012"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {driver && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">상태</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  driver.isOnDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {driver.isOnDuty ? '업무 중' : '업무 종료'}
                </span>
              </div>
              {driver.isOnDuty && driver.dutyStartedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  개시: {formatDate(driver.dutyStartedAt)}
                </p>
              )}
            </div>
          )}

          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleStartDuty}
              disabled={loading || (driver?.isOnDuty)}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
            >
              업무 개시
            </button>
            <button
              onClick={handleEndDuty}
              disabled={loading || !driver?.isOnDuty}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg disabled:bg-gray-300"
            >
              업무 종료
            </button>
          </div>

          {message && (
            <p className={`mt-3 text-sm text-center ${
              messageType === 'success' ? 'text-green-600' :
              messageType === 'error' ? 'text-red-600' : 'text-blue-600'
            }`}>{message}</p>
          )}
        </div>

        {driver?.isOnDuty && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-900">대기 중인 주문</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchPendingOrders}
                  disabled={loadingPending}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  새로고침
                </button>
                <span className="text-sm text-gray-500">{pendingOrders.length}건</span>
              </div>
            </div>

            {loadingPending ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pendingOrders.length === 0 ? (
              <p className="text-center text-gray-500 py-8">대기 중인 주문이 없습니다</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === pendingOrders.length && pendingOrders.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-600">전체 선택</span>
                  </label>
                  {selectedOrders.size > 0 && (
                    <button
                      onClick={handleAssignSelected}
                      disabled={loading}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:bg-gray-300"
                    >
                      선택 배정 ({selectedOrders.size})
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {pendingOrders.map((group) => (
                    <div
                      key={group.id}
                      className={`border rounded-lg p-3 ${
                        selectedOrders.has(group.id) ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(group.id)}
                          onChange={() => handleSelectOrder(group.id)}
                          className="mt-1 w-4 h-4 rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{group.customerName || '고객'}</p>
                              <p className="text-xs text-gray-500">{group.customerPhone}</p>
                              <p className="text-xs text-gray-400 mt-1">{group.deliveryAddress}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-sm text-green-600">
                                {group.totalDeliveryFee.toLocaleString()}원
                              </p>
                              <button
                                onClick={() => handleAssignSingle(group.id)}
                                disabled={loading}
                                className="mt-2 px-2 py-1 bg-green-600 text-white text-xs rounded disabled:bg-gray-300"
                              >
                                배정
                              </button>
                            </div>
                          </div>

                          {group.customerMemo && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                              요청사항: {group.customerMemo}
                            </div>
                          )}

                          <div className="mt-2 space-y-1">
                            {group.orders.map((order) => (
                              <div key={order.id} className="text-xs text-gray-600">
                                <span className="font-medium">#{order.orderNumber}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span>{order.restaurantName}</span>
                                <span className="text-gray-400 mx-1">|</span>
                                <span>{order.items.join(', ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {driver?.isOnDuty && assignedOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-900">배정된 주문</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchAssignedOrders}
                  disabled={loadingAssigned}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  새로고침
                </button>
                <span className="text-sm text-gray-500">{assignedOrders.length}건</span>
              </div>
            </div>

            {loadingAssigned ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-3 border-orange-200 bg-orange-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-sm">#{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'delivering' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'picked_up' ? 'bg-purple-100 text-purple-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status === 'delivering' ? '배달중' :
                             order.status === 'picked_up' ? '픽업완료' :
                             order.status === 'preparing' ? '조리중' : order.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{order.restaurantName}</p>
                        <p className="text-sm text-gray-700 mt-1">{order.customerName || '고객'}</p>
                        <p className="text-xs text-gray-500">{order.customerPhone}</p>
                        <p className="text-xs text-gray-400 mt-1">{order.deliveryAddress}</p>

                        {order.customerMemo && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                            요청사항: {order.customerMemo}
                          </div>
                        )}

                        <div className="mt-2 text-xs text-gray-600">
                          {order.items.join(', ')}
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-medium text-sm text-green-600">
                          {order.deliveryFee.toLocaleString()}원
                        </p>
                        <button
                          onClick={() => handleCompleteDelivery(order.id)}
                          disabled={loading}
                          className="mt-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg disabled:bg-gray-300 hover:bg-green-700"
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {driver && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="font-semibold text-gray-900 mb-3">배달 내역</h2>
              
              <div className="flex items-center space-x-2 mb-3">
                <label className="text-sm text-gray-600">기간:</label>
                <button
                  onClick={() => setUseDateRange(false)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    !useDateRange ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  날짜
                </button>
                <button
                  onClick={() => setUseDateRange(true)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${
                    useDateRange ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  기간
                </button>
              </div>

              {!useDateRange ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => setDate(today)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      date === today ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    오늘
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold text-gray-900">처리 내역</h2>
                <span className="text-sm text-gray-500">{summary.totalDeliveries}건</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : deliveries.length === 0 ? (
                <p className="text-center text-gray-500 py-8">배달 내역이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">#{delivery.orderNumber}</p>
                          <p className="text-xs text-gray-500">{delivery.restaurant.name}</p>
                          <p className="text-xs text-gray-400">{delivery.deliveryAddress}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">{delivery.deliveryFee.toLocaleString()}원</p>
                          <p className="text-xs text-gray-400">{formatDate(delivery.deliveredAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-blue-900">배달비 합계</span>
                <span className="text-xl font-bold text-blue-900">
                  {summary.totalDeliveryFee.toLocaleString()}원
                </span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                총 {summary.totalDeliveries}건 배달 완료
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
