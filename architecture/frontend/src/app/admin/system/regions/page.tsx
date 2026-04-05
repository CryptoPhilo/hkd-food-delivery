'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

interface Region {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  centerLatitude: number;
  centerLongitude: number;
  addressKeyword: string;
  isActive: boolean;
  domain: string | null;
  platformHours: any;
  deliveryFeeSettings: any;
  restaurantCount: number;
  driverCount: number;
  orderCount: number;
  adminCount: number;
}

const emptyForm = {
  code: '',
  name: '',
  nameEn: '',
  centerLatitude: '',
  centerLongitude: '',
  addressKeywords: [''],
  domain: '',
  isActive: true,
  autoScrape: true,
};

export default function RegionsPage() {
  const { isSystemAdmin, adminFetch } = useAdminAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRegions(); }, []);

  const fetchRegions = async () => {
    try {
      const res = await adminFetch('/api/v1/admin/auth/regions');
      const data = await res.json();
      if (data.success) setRegions(data.data);
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      alert('지역 코드와 이름은 필수입니다');
      return;
    }
    setSaving(true);
    const url = editingId
      ? `/api/v1/admin/auth/regions/${editingId}`
      : '/api/v1/admin/auth/regions';

    // 빈 키워드 제거
    const keywords = form.addressKeywords.filter(k => k.trim());

    const body: any = {
      code: form.code,
      name: form.name,
      nameEn: form.nameEn || null,
      centerLatitude: parseFloat(form.centerLatitude) || 0,
      centerLongitude: parseFloat(form.centerLongitude) || 0,
      addressKeywords: keywords,
      domain: form.domain.trim() || null,
    };

    if (editingId) {
      body.isActive = form.isActive;
    } else {
      body.autoScrape = form.autoScrape;
    }

    try {
      const res = await adminFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        fetchRegions();
        if (!editingId && form.autoScrape && keywords.length > 0) {
          alert('지역이 생성되었습니다. 식당 목록 수집이 백그라운드에서 진행됩니다.\n수집된 식당은 비활성 상태로 등록되며, 메뉴 수집 후 활성화하면 고객에게 노출됩니다.');
        }
      } else {
        alert(data.error || '저장 실패');
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const geocodeAddress = async (address: string) => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const res = await adminFetch(`/api/v1/restaurants/geocode?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({
          ...prev,
          centerLatitude: String(parseFloat(data.data.latitude).toFixed(4)),
          centerLongitude: String(parseFloat(data.data.longitude).toFixed(4)),
        }));
      } else {
        alert('좌표를 찾을 수 없습니다. 주소를 더 구체적으로 입력해주세요.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
    } finally {
      setGeocoding(false);
    }
  };

  const handleEdit = (r: Region) => {
    setEditingId(r.id);
    // addressKeyword를 쉼표로 분리하여 배열로 변환
    const keywords = r.addressKeyword ? r.addressKeyword.split(',').map(k => k.trim()) : [''];
    setForm({
      code: r.code,
      name: r.name,
      nameEn: r.nameEn || '',
      centerLatitude: String(r.centerLatitude),
      centerLongitude: String(r.centerLongitude),
      addressKeywords: keywords.length > 0 ? keywords : [''],
      domain: r.domain || '',
      isActive: r.isActive,
      autoScrape: false,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('지역을 삭제하시겠습니까?')) return;
    const res = await adminFetch(`/api/v1/admin/auth/regions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) fetchRegions();
    else alert(data.error || '삭제 실패');
  };

  // 행정구역 키워드 배열 관리
  const addKeyword = () => {
    setForm(prev => ({ ...prev, addressKeywords: [...prev.addressKeywords, ''] }));
  };

  const removeKeyword = (index: number) => {
    setForm(prev => ({
      ...prev,
      addressKeywords: prev.addressKeywords.filter((_, i) => i !== index),
    }));
  };

  const updateKeyword = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      addressKeywords: prev.addressKeywords.map((k, i) => i === index ? value : k),
    }));
  };

  if (!isSystemAdmin) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">시스템 관리자 권한이 필요합니다</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">지역 관리</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + 지역 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">{editingId ? '지역 수정' : '새 지역 추가'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지역 코드 *</label>
              <input type="text" value={form.code} onChange={e => setForm({...form, code: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="jeju-hangyeong" disabled={!!editingId} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">지역 이름 *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="제주 한경면" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">영문 이름</label>
              <input type="text" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="Jeju Hangyeong" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">도메인 (선택)</label>
              <input type="text" value={form.domain} onChange={e => setForm({...form, domain: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="비워두면 GPS 기반 자동 감지" />
            </div>

            {/* 복수 행정구역명 입력 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">행정구역명 (식당 수집 검색어)</label>
              <div className="space-y-2">
                {form.addressKeywords.map((keyword, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={e => updateKeyword(index, e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-2"
                      placeholder={`행정구역명 ${index + 1} (예: 제주특별자치도 제주시 한경면)`}
                    />
                    {index === 0 && (
                      <button
                        type="button"
                        onClick={() => geocodeAddress(keyword || form.name)}
                        disabled={geocoding || (!keyword && !form.name)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                      >
                        {geocoding ? '...' : '좌표'}
                      </button>
                    )}
                    {form.addressKeywords.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addKeyword}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                + 행정구역 추가
              </button>
              <p className="text-xs text-gray-400 mt-1">
                여러 행정구역을 하나의 지역으로 묶을 수 있습니다. 각 행정구역명으로 식당 목록이 자동 수집됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">중심 위도</label>
              <input type="text" value={form.centerLatitude} onChange={e => setForm({...form, centerLatitude: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="33.3200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">중심 경도</label>
              <input type="text" value={form.centerLongitude} onChange={e => setForm({...form, centerLongitude: e.target.value})}
                className="w-full border rounded-lg px-3 py-2" placeholder="126.1700" />
            </div>

            {editingId && (
              <div className="flex items-center pt-6">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})}
                  className="mr-2" id="regionActive" />
                <label htmlFor="regionActive" className="text-sm text-gray-700">활성 상태</label>
              </div>
            )}

            {!editingId && (
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={form.autoScrape}
                    onChange={e => setForm({...form, autoScrape: e.target.checked})}
                    className="mr-2"
                    id="autoScrape"
                  />
                  <label htmlFor="autoScrape" className="text-sm font-medium text-blue-800">
                    지역 생성 시 식당 목록 자동 수집
                  </label>
                </div>
                <p className="text-xs text-blue-600 ml-5">
                  행정구역명을 기반으로 해당 지역의 식당을 자동으로 수집합니다.
                  수집된 식당은 <strong>비활성 상태</strong>로 등록되며, 메뉴를 수집한 후 활성화하면 고객 페이지에 노출됩니다.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {regions.map(r => (
            <div key={r.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">{r.name}</h3>
                  <p className="text-sm text-gray-500">{r.code} {r.domain && `| ${r.domain}`}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {r.isActive ? '활성' : '비활성'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold text-blue-600">{r.restaurantCount}</p>
                  <p className="text-xs text-gray-500">식당</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold text-green-600">{r.driverCount}</p>
                  <p className="text-xs text-gray-500">배달원</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold text-orange-600">{r.orderCount}</p>
                  <p className="text-xs text-gray-500">주문</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-lg font-bold text-purple-600">{r.adminCount}</p>
                  <p className="text-xs text-gray-500">관리자</p>
                </div>
              </div>
              <div className="text-xs text-gray-400 mb-3">
                <p>행정구역: {r.addressKeyword ? r.addressKeyword.split(',').join(', ') : '(없음)'}</p>
                <p>좌표: {Number(r.centerLatitude).toFixed(4)}, {Number(r.centerLongitude).toFixed(4)}</p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleEdit(r)}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">수정</button>
                <button onClick={() => handleDelete(r.id)}
                  className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
