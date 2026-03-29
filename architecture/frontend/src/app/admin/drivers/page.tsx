'use client';

import { useState, useEffect } from 'react';

interface Driver {
  id: string;
  phone: string;
  name: string | null;
  cardNumber: string | null;
  isOnDuty: boolean;
  dutyStartedAt: string | null;
  dutyEndedAt: string | null;
  totalDeliveries: number;
  totalDeliveryFee: number;
  createdAt: string;
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

export default function AdminDriversPage() {
  const today = new Date().toISOString().split('T')[0];
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliverySummary, setDeliverySummary] = useState({ totalDeliveries: 0, totalDeliveryFee: 0 });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(today);
  const [showOnDutyOnly, setShowOnDutyOnly] = useState(false);
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverCardNumber, setNewDriverCardNumber] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDrivers();
  }, [showOnDutyOnly]);

  useEffect(() => {
    if (selectedDriver) {
      fetchDriverDeliveries(selectedDriver.phone);
    }
  }, [selectedDriver, dateFilter]);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (showOnDutyOnly) {
        params.append('isOnDuty', 'true');
      }
      
      const response = await fetch(`/api/v1/admin/drivers?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setDrivers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverDeliveries = async (phone: string) => {
    try {
      const response = await fetch(`/api/v1/drivers/deliveries?phone=${encodeURIComponent(phone)}&date=${dateFilter}`);
      const data = await response.json();
      if (data.success) {
        setDeliveries(data.data.deliveries);
        setDeliverySummary(data.data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch driver deliveries:', error);
    }
  };

  const handleRegisterDriver = async () => {
    if (!newDriverPhone) {
      setMessage('전화번호를 입력해주세요');
      return;
    }

    try {
      const response = await fetch('/api/v1/admin/drivers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newDriverPhone,
          name: newDriverName || null,
          cardNumber: newDriverCardNumber || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage('배달원이 등록되었습니다');
        setShowRegisterModal(false);
        setNewDriverPhone('');
        setNewDriverName('');
        setNewDriverCardNumber('');
        fetchDrivers();
      } else {
        setMessage(data.error || '등록 실패');
      }
    } catch (error) {
      setMessage('오류가 발생했습니다');
    }
  };

  const handleDeleteDriver = async () => {
    if (!selectedDriver) return;

    try {
      const response = await fetch(`/api/v1/admin/drivers/${selectedDriver.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        setMessage('배달원이 삭제되었습니다');
        setShowDeleteModal(false);
        setSelectedDriver(null);
        fetchDrivers();
      } else {
        setMessage(data.error || '삭제 실패');
      }
    } catch (error) {
      setMessage('오류가 발생했습니다');
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">배달원 관리</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showOnDutyOnly}
              onChange={(e) => setShowOnDutyOnly(e.target.checked)}
              className="mr-2"
            />
            업무 중인 배달원만
          </label>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            배달원 등록
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 배달</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 배달비</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : drivers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      배달원이 없습니다
                    </td>
                  </tr>
                ) : (
                  drivers.map((driver) => (
                    <tr
                      key={driver.id}
                      onClick={() => setSelectedDriver(driver)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedDriver?.id === driver.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{driver.name || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {driver.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          driver.isOnDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {driver.isOnDuty ? '업무 중' : '업무 종료'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {driver.totalDeliveries}건
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {driver.totalDeliveryFee.toLocaleString()}원
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-1">
          {selectedDriver ? (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-medium text-lg mb-4">배달원 상세</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">이름</span>
                    <span className="font-medium">{selectedDriver.name || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">전화번호</span>
                    <span>{selectedDriver.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">카드번호</span>
                    <span>{selectedDriver.cardNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">상태</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedDriver.isOnDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedDriver.isOnDuty ? '업무 중' : '업무 종료'}
                    </span>
                  </div>
                  {selectedDriver.isOnDuty && selectedDriver.dutyStartedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">업무 개시</span>
                      <span>{formatDate(selectedDriver.dutyStartedAt)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-medium">
                      <span>총 배달 건수</span>
                      <span>{selectedDriver.totalDeliveries}건</span>
                    </div>
                    <div className="flex justify-between font-medium mt-1">
                      <span>총 배달비</span>
                      <span>{selectedDriver.totalDeliveryFee.toLocaleString()}원</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      disabled={selectedDriver.isOnDuty}
                      className="w-full py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      배달원 삭제
                    </button>
                    {selectedDriver.isOnDuty && (
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        업무 중인 배달원은 삭제할 수 없습니다
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium">배달 내역</h3>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">{dateFilter} 배달</span>
                    <span className="font-medium text-blue-900">{deliverySummary.totalDeliveries}건</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-blue-700">배달비 합계</span>
                    <span className="font-medium text-blue-900">{deliverySummary.totalDeliveryFee.toLocaleString()}원</span>
                  </div>
                </div>

                {deliveries.length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">배달 내역이 없습니다</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {deliveries.map((delivery) => (
                      <div key={delivery.id} className="border rounded p-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">#{delivery.orderNumber}</span>
                          <span className="text-gray-500">{delivery.deliveryFee.toLocaleString()}원</span>
                        </div>
                        <p className="text-xs text-gray-400">{delivery.restaurant.name}</p>
                        <p className="text-xs text-gray-400">{formatDate(delivery.deliveredAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              배달원을 선택하세요
            </div>
          )}
        </div>
      </div>

      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowRegisterModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">배달원 등록</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">구매카드 번호</label>
                <input
                  type="text"
                  value={newDriverCardNumber}
                  onChange={(e) => setNewDriverCardNumber(e.target.value)}
                  placeholder="1234-5678-9012"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleRegisterDriver}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDeleteModal(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">배달원 삭제</h3>
            <p className="text-gray-600 mb-4">
              정말 <strong>{selectedDriver.name || selectedDriver.phone}</strong> 배달원을 삭제하시겠습니까?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDeleteDriver}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
