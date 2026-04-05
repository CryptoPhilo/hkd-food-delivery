'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export default function OperationPage() {
  const { adminFetch } = useAdminAuth();
  const [isActive, setIsActive] = useState(true);
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [closedDays, setClosedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const dayKeyMap: Record<number, string> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday',
  };
  const dayLabels: Record<string, string> = {
    monday: '월', tuesday: '화', wednesday: '수', thursday: '목',
    friday: '금', saturday: '토', sunday: '일',
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await adminFetch('/api/v1/settings/platform-hours');
      const data = await response.json();
      if (data.success && data.data) {
        setIsActive(data.data.isActive !== false);
        setOpenTime(data.data.openTime || '09:00');
        setCloseTime(data.data.closeTime || '22:00');
        setClosedDays(data.data.closedDays || []);
      }
    } catch (error) {
      console.error('Failed to fetch platform status:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async () => {
    const newIsActive = !isActive;
    setToggling(true);
    try {
      const response = await adminFetch('/api/v1/settings/platform-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openTime,
          closeTime,
          closedDays,
          isActive: newIsActive,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setIsActive(newIsActive);
      } else {
        alert('상태 변경에 실패했습니다.');
      }
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다.');
    } finally {
      setToggling(false);
    }
  };

  const getStatus = () => {
    if (!isActive) {
      return { isOpen: false, label: '임시 휴무', color: 'red' };
    }

    const now = new Date();
    const todayKey = dayKeyMap[now.getDay()];
    if (closedDays.includes(todayKey)) {
      return { isOpen: false, label: '정기 휴무일', color: 'orange' };
    }

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = openTime.split(':').map(Number);
    const [ch, cm] = closeTime.split(':').map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;

    let withinHours = false;
    if (close < open) {
      withinHours = currentTime >= open || currentTime < close;
    } else {
      withinHours = currentTime >= open && currentTime < close;
    }

    if (withinHours) {
      return { isOpen: true, label: '영업 중', color: 'green' };
    }
    return { isOpen: false, label: '운영 시간 외', color: 'gray' };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const status = getStatus();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">영업 상태</h1>

      <div className="max-w-lg mx-auto space-y-6">
        {/* 현재 상태 카드 */}
        <div className={`rounded-2xl shadow-lg p-8 text-center ${
          status.color === 'green' ? 'bg-green-50 border-2 border-green-200' :
          status.color === 'red' ? 'bg-red-50 border-2 border-red-200' :
          status.color === 'orange' ? 'bg-orange-50 border-2 border-orange-200' :
          'bg-gray-50 border-2 border-gray-200'
        }`}>
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            status.color === 'green' ? 'bg-green-100' :
            status.color === 'red' ? 'bg-red-100' :
            status.color === 'orange' ? 'bg-orange-100' :
            'bg-gray-100'
          }`}>
            <div className={`w-6 h-6 rounded-full ${
              status.color === 'green' ? 'bg-green-500' :
              status.color === 'red' ? 'bg-red-500' :
              status.color === 'orange' ? 'bg-orange-500' :
              'bg-gray-400'
            }`}></div>
          </div>
          <h2 className={`text-2xl font-bold mb-1 ${
            status.color === 'green' ? 'text-green-800' :
            status.color === 'red' ? 'text-red-800' :
            status.color === 'orange' ? 'text-orange-800' :
            'text-gray-600'
          }`}>
            {status.label}
          </h2>
          <p className="text-sm text-gray-500">
            운영 시간: {openTime} ~ {closeTime}
            {closedDays.length > 0 && (
              <span> | 정기 휴무: {closedDays.map(d => dayLabels[d]).filter(Boolean).join(', ')}</span>
            )}
          </p>
        </div>

        {/* 토글 버튼 */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {isActive ? '영업 중' : '임시 휴무 중'}
              </p>
              <p className="text-sm text-gray-500">
                {isActive
                  ? '임시 휴무로 전환하면 고객 주문이 즉시 차단됩니다'
                  : '영업 개시하면 운영 시간 내 고객 주문이 가능합니다'}
              </p>
            </div>
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 ${
                toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${isActive ? 'bg-green-500' : 'bg-red-400'}`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  isActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {!isActive && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-700">
                현재 임시 휴무 상태입니다. 고객이 주문할 수 없습니다.
              </p>
            </div>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500">
            운영 시간 및 정기 휴무일 변경은 시스템 관리자만 가능합니다.
            긴급 상황이나 임시 휴무가 필요한 경우 위 토글을 사용하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
