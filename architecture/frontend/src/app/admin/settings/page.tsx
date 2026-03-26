'use client';

import { useState, useEffect } from 'react';

interface ScrapeJob {
  id: string;
  area: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  restaurantCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface BusinessHours {
  openTime: string;
  closeTime: string;
  closedDays: string[];
  isHoliday: boolean;
}

const SEOUL_DISTRICTS = [
  '서울 강남구', '서울 강동구', '서울 강북구', '서울 강서구', '서울 관악구',
  '서울 광진구', '서울 구로구', '서울 금천구', '서울 노원구', '서울 도봉구',
  '서울 동대문구', '서울 동작구', '서울 마포구', '서울 서대문구', '서울 서초구',
  '서울 성동구', '서울 성북구', '서울 송파구', '서울 양천구', '서울 영등포구',
  '서울 용산구', '서울 은평구', '서울 종로구', '서울 중구', '서울 중랑구',
];

const COMMON_AREAS = [
  '강남역', '홍대입구역', '명동', '잠실역', '신촌',
  '이태원', '建大', '사당', '왕십리', '천호',
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'scrape' | 'platform' | 'business' | 'delivery' | 'general'>('scrape');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [customArea, setCustomArea] = useState('');
  const [scrapeJobs, setScrapeJobs] = useState<ScrapeJob[]>([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');

  const handleAreaToggle = (area: string) => {
    setSelectedAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleStartScrape = async () => {
    const areasToScrape = customArea ? [...selectedAreas, customArea] : selectedAreas;
    
    if (areasToScrape.length === 0) {
      alert('최소 하나의 지역을 선택해주세요');
      return;
    }

    setScrapeLoading(true);
    setScrapeProgress('스크랩을 시작합니다...');

    try {
      for (const area of areasToScrape) {
        setScrapeProgress(`${area} 식당 데이터 수집 중...`);
        
        const response = await fetch('/api/v1/admin/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area }),
        });

        const data = await response.json();
        
        const newJob: ScrapeJob = {
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          area,
          status: data.success ? 'completed' : 'failed',
          restaurantCount: data.syncedCount || 0,
          createdAt: new Date().toISOString(),
          completedAt: data.success ? new Date().toISOString() : null,
        };

        setScrapeJobs(prev => [newJob, ...prev]);
      }

      setScrapeProgress('모든 스크랩이 완료되었습니다');
      setSelectedAreas([]);
      setCustomArea('');
    } catch (error) {
      setScrapeProgress('스크랩 중 오류가 발생했습니다');
    } finally {
      setScrapeLoading(false);
    }
  };

  const tabs = [
    { key: 'scrape', label: '데이터 수집' },
    { key: 'platform', label: '플랫폼 운영' },
    { key: 'business', label: '영업시간' },
    { key: 'delivery', label: '배달 설정' },
    { key: 'general', label: '일반' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">설정</h1>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'platform' && <PlatformHoursSettings />}
      {activeTab === 'scrape' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium mb-4">행정구역별 식당 데이터 수집</h2>
            <p className="text-sm text-gray-500 mb-4">
              선택한 지역에서 네이버 지도 API를 통해 식당 및 메뉴 정보를 수집합니다.
              수집된 데이터는 자동으로 데이터베이스에 저장됩니다.
            </p>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">서울行政区 선택</h3>
              <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {SEOUL_DISTRICTS.map((area) => (
                  <button
                    key={area}
                    onClick={() => handleAreaToggle(area)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedAreas.includes(area)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {area.replace('서울 ', '')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">인기 지역</h3>
              <div className="flex flex-wrap gap-2">
                {COMMON_AREAS.map((area) => (
                  <button
                    key={area}
                    onClick={() => handleAreaToggle(area)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      selectedAreas.includes(area)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">직접 입력</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="지역명을 입력하세요 (예: 부산 해운대구)"
                  className="flex-1 border rounded-lg px-3 py-2"
                />
                <button
                  onClick={() => {
                    if (customArea && !selectedAreas.includes(customArea)) {
                      setSelectedAreas([...selectedAreas, customArea]);
                      setCustomArea('');
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  추가
                </button>
              </div>
              {selectedAreas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                    >
                      {area}
                      <button
                        onClick={() => handleAreaToggle(area)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <button
                onClick={handleStartScrape}
                disabled={scrapeLoading || selectedAreas.length === 0}
                className={`w-full py-3 rounded-lg font-medium transition-colors ${
                  scrapeLoading || selectedAreas.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {scrapeLoading ? '收集中...' : `${selectedAreas.length}개 지역 스크랩 시작`}
              </button>
              {scrapeProgress && (
                <p className="mt-2 text-sm text-center text-gray-600">{scrapeProgress}</p>
              )}
            </div>
          </div>

          {scrapeJobs.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium mb-4">수집 기록</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        지역
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        상태
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        식당 수
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        완료 시간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {scrapeJobs.map((job) => (
                      <tr key={job.id}>
                        <td className="px-4 py-3 text-sm">{job.area}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            job.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : job.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {job.status === 'completed' ? '완료' : 
                             job.status === 'failed' ? '실패' : '대기중'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{job.restaurantCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {job.completedAt 
                            ? new Date(job.completedAt).toLocaleString('ko-KR')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'business' && <BusinessHoursSettings />}
      {activeTab === 'delivery' && <DeliverySettings />}
      {activeTab === 'general' && <GeneralSettings />}
    </div>
  );
}

function PlatformHoursSettings() {
  const [settings, setSettings] = useState({
    openTime: '09:00',
    closeTime: '22:00',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPlatformHours();
  }, []);

  const fetchPlatformHours = async () => {
    try {
      const response = await fetch('/api/v1/settings/platform-hours');
      const data = await response.json();
      if (data.success && data.data) {
        setSettings({
          openTime: data.data.openTime || '09:00',
          closeTime: data.data.closeTime || '22:00',
          isActive: data.data.isActive !== false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch platform hours:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/settings/platform-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-2">플랫폼 운영 시간</h2>
        <p className="text-sm text-gray-500 mb-4">
          한경배달 플랫폼의 운영 시간을 설정합니다. 운영 시간 외에는 고객이 주문을 할 수 없습니다.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">플랫폼 운영</p>
              <p className="text-sm text-gray-500">운영 시간에만 주문 가능</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, isActive: !settings.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                settings.isActive ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">개장 시간</label>
              <input
                type="time"
                value={settings.openTime}
                onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">마감 시간</label>
              <input
                type="time"
                value={settings.closeTime}
                onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              운영 시간: {settings.openTime} ~ {settings.closeTime}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2 rounded-lg font-medium ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-2">플랫폼 상태</h2>
        <p className="text-sm text-gray-500 mb-4">
          현재 플랫폼이 주문 가능한지 확인합니다.
        </p>
        <PlatformStatusCheck openTime={settings.openTime} closeTime={settings.closeTime} isActive={settings.isActive} />
      </div>
    </div>
  );
}

function PlatformStatusCheck({ openTime, closeTime, isActive }: { openTime: string; closeTime: string; isActive: boolean }) {
  const [status, setStatus] = useState<{ isOpen: boolean; message: string } | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [openTime, closeTime, isActive]);

  const checkStatus = () => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);

    const open = openHour * 60 + openMin;
    const close = closeHour * 60 + closeMin;

    let isOpen = false;
    let message = '';

    if (!isActive) {
      isOpen = false;
      message = '플랫폼이 비활성화되어 있습니다.';
    } else if (close < open) {
      if (currentTime >= open || currentTime < close) {
        isOpen = true;
        message = '배달 가능';
      } else {
        message = '운영 시간 아님';
      }
    } else {
      if (currentTime >= open && currentTime < close) {
        isOpen = true;
        message = '배달 가능';
      } else {
        message = '운영 시간 아님';
      }
    }

    setStatus({ isOpen, message });
  };

  if (!status) return null;

  return (
    <div className={`p-4 rounded-lg ${status.isOpen ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-3 ${status.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className={`font-medium ${status.isOpen ? 'text-green-800' : 'text-red-800'}`}>
          {status.isOpen ? '운영 중' : '운영 종료'}
        </span>
      </div>
      <p className={`text-sm mt-1 ${status.isOpen ? 'text-green-600' : 'text-red-600'}`}>
        {status.message}
      </p>
    </div>
  );
}

function BusinessHoursSettings() {
  const [settings, setSettings] = useState({
    openTime: '09:00',
    closeTime: '22:00',
    closedDays: ['sunday'],
    isHoliday: false,
  });

  const days = [
    { key: 'monday', label: '월' },
    { key: 'tuesday', label: '화' },
    { key: 'wednesday', label: '수' },
    { key: 'thursday', label: '목' },
    { key: 'friday', label: '금' },
    { key: 'saturday', label: '토' },
    { key: 'sunday', label: '일' },
  ];

  const toggleDay = (day: string) => {
    setSettings(prev => ({
      ...prev,
      closedDays: prev.closedDays.includes(day)
        ? prev.closedDays.filter(d => d !== day)
        : [...prev.closedDays, day]
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">영업시간 설정</h2>
      <div className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">개장 시간</label>
            <input
              type="time"
              value={settings.openTime}
              onChange={(e) => setSettings({ ...settings, openTime: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">마감 시간</label>
            <input
              type="time"
              value={settings.closeTime}
              onChange={(e) => setSettings({ ...settings, closeTime: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">휴일</label>
          <div className="flex space-x-2">
            {days.map((day) => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={`px-3 py-2 rounded-lg text-sm ${
                  settings.closedDays.includes(day.key)
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          저장
        </button>
      </div>
    </div>
  );
}

function DeliverySettings() {
  const [settings, setSettings] = useState({
    baseFee: 3000,
    perKmFee: 500,
    maxDistance: 5.0,
    freeDeliveryThreshold: 30000,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchDeliveryFee();
  }, []);

  const fetchDeliveryFee = async () => {
    try {
      const response = await fetch('/api/v1/settings/delivery-fee');
      const data = await response.json();
      if (data.success && data.data) {
        setSettings({
          baseFee: data.data.baseFee || 3000,
          perKmFee: data.data.perKmFee || 500,
          maxDistance: data.data.maxDistance || 5.0,
          freeDeliveryThreshold: data.data.freeDeliveryThreshold || 30000,
        });
      }
    } catch (error) {
      console.error('Failed to fetch delivery fee:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/settings/delivery-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">배달비 설정</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 배달비 (2km 이내)</label>
          <input
            type="number"
            value={settings.baseFee}
            onChange={(e) => setSettings({ ...settings, baseFee: parseInt(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">km당 추가 요금</label>
          <input
            type="number"
            value={settings.perKmFee}
            onChange={(e) => setSettings({ ...settings, perKmFee: parseInt(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">최대 배달 거리 (km)</label>
          <input
            type="number"
            step="0.5"
            value={settings.maxDistance}
            onChange={(e) => setSettings({ ...settings, maxDistance: parseFloat(e.target.value) })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2 rounded-lg font-medium ${
            saving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4">일반 설정</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">서비스 이름</label>
          <input
            type="text"
            defaultValue="한경배달"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">고객센터 전화번호</label>
          <input
            type="tel"
            placeholder="02-1234-5678"
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          저장
        </button>
      </div>
    </div>
  );
}
