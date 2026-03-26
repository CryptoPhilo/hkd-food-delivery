'use client';

import { useState, useEffect } from 'react';

interface Menu {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  category: string | null;
  description: string | null;
  rating: number | null;
  businessHours: string | null;
  isActive: boolean;
  isDeliverable: boolean;
  deliveryRadius: number;
  menus: Menu[];
}

interface RestaurantFormData {
  name: string;
  address: string;
  roadAddress: string;
  phone: string;
  category: string;
  description: string;
  latitude: string;
  longitude: string;
  rating: string;
  businessHours: string;
  isDeliverable: boolean;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuForm, setMenuForm] = useState({ name: '', description: '', price: '', imageUrl: '' });
  const [restaurantForm, setRestaurantForm] = useState<RestaurantFormData>({
    name: '',
    address: '',
    roadAddress: '',
    phone: '',
    category: '',
    description: '',
    latitude: '',
    longitude: '',
    rating: '',
    businessHours: '',
    isDeliverable: true,
  });
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch('/api/v1/admin/restaurants');
      const data = await response.json();
      if (data.success) {
        setRestaurants(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRestaurantActive = async (restaurantId: string, isActive: boolean) => {
    try {
      await fetch(`/api/v1/admin/restaurants/${restaurantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchRestaurants();
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const toggleRestaurantDeliverable = async (restaurantId: string, isDeliverable: boolean) => {
    try {
      await fetch(`/api/v1/admin/restaurants/${restaurantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDeliverable: !isDeliverable }),
      });
      fetchRestaurants();
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const toggleMenuAvailable = async (menuId: string, isAvailable: boolean) => {
    try {
      await fetch(`/api/v1/admin/menus/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !isAvailable }),
      });
      fetchRestaurants();
      if (selectedRestaurant) {
        const updated = restaurants.find(r => r.id === selectedRestaurant.id);
        if (updated) setSelectedRestaurant(updated);
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const openMenuModal = (menu?: Menu) => {
    if (menu) {
      setEditingMenu(menu);
      setMenuForm({
        name: menu.name,
        description: menu.description || '',
        price: String(menu.price),
        imageUrl: menu.imageUrl || '',
      });
    } else {
      setEditingMenu(null);
      setMenuForm({ name: '', description: '', price: '', imageUrl: '' });
    }
    setShowMenuModal(true);
  };

  const saveMenu = async () => {
    if (!selectedRestaurant || !menuForm.name || !menuForm.price) {
      alert('메뉴 이름과 가격을 입력해주세요');
      return;
    }

    try {
      const url = editingMenu
        ? `/api/v1/admin/menus/${editingMenu.id}`
        : '/api/v1/admin/menus';
      
      const method = editingMenu ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: selectedRestaurant.id,
          name: menuForm.name,
          description: menuForm.description || null,
          price: parseInt(menuForm.price),
          imageUrl: menuForm.imageUrl || null,
        }),
      });

      setShowMenuModal(false);
      fetchRestaurants();
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const filteredRestaurants = restaurants.filter(r => {
    if (filter === 'active') return r.isActive;
    if (filter === 'inactive') return !r.isActive;
    return true;
  });

  const importMockData = async () => {
    if (!confirm('Mock 데이터를 import하시겠습니까? 기존 데이터는 건너뜁니다.')) return;
    
    setImporting(true);
    try {
      const response = await fetch('/api/v1/admin/import-mock', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchRestaurants();
      } else {
        alert(data.error || 'Import 실패');
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    } finally {
      setImporting(false);
    }
  };

  const saveRestaurant = async () => {
    if (!restaurantForm.name || !restaurantForm.address) {
      alert('식당 이름과 주소는 필수입니다');
      return;
    }

    try {
      const response = await fetch('/api/v1/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: restaurantForm.name,
          address: restaurantForm.address,
          roadAddress: restaurantForm.roadAddress || null,
          phone: restaurantForm.phone || null,
          category: restaurantForm.category || null,
          description: restaurantForm.description || null,
          latitude: parseFloat(restaurantForm.latitude) || 0,
          longitude: parseFloat(restaurantForm.longitude) || 0,
          rating: parseFloat(restaurantForm.rating) || 0,
          businessHours: restaurantForm.businessHours || null,
          isDeliverable: restaurantForm.isDeliverable,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('식당이 추가되었습니다');
        setShowRestaurantModal(false);
        setRestaurantForm({
          name: '',
          address: '',
          roadAddress: '',
          phone: '',
          category: '',
          description: '',
          latitude: '',
          longitude: '',
          rating: '',
          businessHours: '',
          isDeliverable: true,
        });
        fetchRestaurants();
      } else {
        alert(data.error || '저장 실패');
      }
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const deleteRestaurant = async (id: string) => {
    if (!confirm('식당을 삭제하시겠습니까?')) return;
    
    try {
      await fetch(`/api/v1/admin/restaurants/${id}`, { method: 'DELETE' });
      fetchRestaurants();
      setSelectedRestaurant(null);
    } catch (error) {
      alert('오류가 발생했습니다');
    }
  };

  const openRestaurantModal = (restaurant?: Restaurant) => {
    if (restaurant) {
      setRestaurantForm({
        name: restaurant.name,
        address: restaurant.address,
        roadAddress: restaurant.roadAddress || '',
        phone: restaurant.phone || '',
        category: restaurant.category || '',
        description: restaurant.description || '',
        latitude: String(restaurant.latitude),
        longitude: String(restaurant.longitude),
        rating: String(restaurant.rating || ''),
        businessHours: restaurant.businessHours || '',
        isDeliverable: restaurant.isDeliverable,
      });
    } else {
      setRestaurantForm({
        name: '',
        address: '',
        roadAddress: '',
        phone: '',
        category: '',
        description: '',
        latitude: '',
        longitude: '',
        rating: '',
        businessHours: '',
        isDeliverable: true,
      });
    }
    setShowRestaurantModal(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">식당 관리</h1>
        <div className="flex space-x-2">
          <button
            onClick={importMockData}
            disabled={importing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {importing ? 'Import 중...' : 'Mock 데이터 Import'}
          </button>
          <button
            onClick={() => openRestaurantModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + 식당 추가
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
          >
            전체
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1 rounded ${filter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
          >
            활성
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={`px-3 py-1 rounded ${filter === 'inactive' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
          >
            비활성
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              식당 데이터가 없습니다
            </div>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onSelect={() => setSelectedRestaurant(restaurant)}
                isSelected={selectedRestaurant?.id === restaurant.id}
                onToggleActive={() => toggleRestaurantActive(restaurant.id, restaurant.isActive)}
                onToggleDeliverable={() => toggleRestaurantDeliverable(restaurant.id, restaurant.isDeliverable)}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedRestaurant ? (
            <MenuManagement
              restaurant={selectedRestaurant}
              onToggleAvailable={toggleMenuAvailable}
              onEditMenu={openMenuModal}
              onAddMenu={() => openMenuModal()}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              식당을 선택하세요
            </div>
          )}
        </div>
      </div>

      {showMenuModal && (
        <Modal onClose={() => setShowMenuModal(false)}>
          <h3 className="text-lg font-medium mb-4">
            {editingMenu ? '메뉴 수정' : '메뉴 추가'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                메뉴 이름 *
              </label>
              <input
                type="text"
                value={menuForm.name}
                onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                value={menuForm.description}
                onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                가격 (원) *
              </label>
              <input
                type="number"
                value={menuForm.price}
                onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이미지 URL
              </label>
              <input
                type="url"
                value={menuForm.imageUrl}
                onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })}
                placeholder="https://example.com/menu-image.jpg"
                className="w-full border rounded-lg px-3 py-2"
              />
              {menuForm.imageUrl && (
                <img
                  src={menuForm.imageUrl}
                  alt="미리보기"
                  className="mt-2 w-24 h-24 object-cover rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMenuModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={saveMenu}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showRestaurantModal && (
        <RestaurantModal
          form={restaurantForm}
          setForm={setRestaurantForm}
          onSave={saveRestaurant}
          onClose={() => setShowRestaurantModal(false)}
        />
      )}
    </div>
  );
}

function RestaurantCard({
  restaurant,
  onSelect,
  isSelected,
  onToggleActive,
  onToggleDeliverable,
}: {
  restaurant: Restaurant;
  onSelect: () => void;
  isSelected: boolean;
  onToggleActive: () => void;
  onToggleDeliverable: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900">{restaurant.name}</h3>
          <p className="text-sm text-gray-500">{restaurant.category}</p>
        </div>
        <div className="flex space-x-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            className={`px-2 py-1 text-xs rounded ${restaurant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
          >
            {restaurant.isActive ? '활성' : '비활성'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleDeliverable(); }}
            className={`px-2 py-1 text-xs rounded ${restaurant.isDeliverable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
          >
            {restaurant.isDeliverable ? '배달가능' : '배달불가'}
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-500">
        {restaurant.address}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span>메뉴: {restaurant.menus.length}개</span>
        {restaurant.rating && <span>★ {restaurant.rating}</span>}
      </div>
    </div>
  );
}

function MenuManagement({
  restaurant,
  onToggleAvailable,
  onEditMenu,
  onAddMenu,
}: {
  restaurant: Restaurant;
  onToggleAvailable: (menuId: string, isAvailable: boolean) => void;
  onEditMenu: (menu?: Menu) => void;
  onAddMenu: () => void;
}) {
  const availableMenus = restaurant.menus.filter(m => m.isAvailable);
  const unavailableMenus = restaurant.menus.filter(m => !m.isAvailable);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-bold">{restaurant.name}</h2>
            <p className="text-sm text-gray-500">{restaurant.address}</p>
            {restaurant.phone && <p className="text-sm text-gray-500">☎ {restaurant.phone}</p>}
          </div>
          <button
            onClick={onAddMenu}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            메뉴 추가
          </button>
        </div>

        <div className="border-t">
          <h3 className="font-medium py-3">
            주문 가능 메뉴 ({availableMenus.length})
          </h3>
          {availableMenus.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">주문 가능한 메뉴가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {availableMenus.map((menu) => (
                <MenuItem
                  key={menu.id}
                  menu={menu}
                  onToggle={() => onToggleAvailable(menu.id, menu.isAvailable)}
                  onEdit={() => onEditMenu(menu)}
                />
              ))}
            </div>
          )}
        </div>

        {unavailableMenus.length > 0 && (
          <div className="border-t mt-4">
            <h3 className="font-medium py-3 text-gray-500">
              비활성 메뉴 ({unavailableMenus.length})
            </h3>
            <div className="space-y-2 opacity-60">
              {unavailableMenus.map((menu) => (
                <MenuItem
                  key={menu.id}
                  menu={menu}
                  onToggle={() => onToggleAvailable(menu.id, menu.isAvailable)}
                  onEdit={() => onEditMenu(menu)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  menu,
  onToggle,
  onEdit,
}: {
  menu: Menu;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center">
          <span className="font-medium">{menu.name}</span>
          <span className="ml-2 text-gray-500">{menu.price.toLocaleString()}원</span>
        </div>
        {menu.description && (
          <p className="text-sm text-gray-500">{menu.description}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            menu.isAvailable ? 'bg-green-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              menu.isAvailable ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <button
          onClick={onEdit}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
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

function RestaurantModal({
  form,
  setForm,
  onSave,
  onClose,
}: {
  form: RestaurantFormData;
  setForm: (f: RestaurantFormData) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-medium mb-4">식당 추가</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">식당 이름 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">주소 *</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">도로명 주소</label>
          <input
            type="text"
            value={form.roadAddress}
            onChange={(e) => setForm({ ...form, roadAddress: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">위도</label>
            <input
              type="text"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="33.xxxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경도</label>
            <input
              type="text"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="126.xxxx"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="064-xxx-xxxx"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="음식점 > 한식 > 고기"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">영업시간</label>
          <input
            type="text"
            value={form.businessHours}
            onChange={(e) => setForm({ ...form, businessHours: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="10:00-22:00"
          />
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isDeliverable"
            checked={form.isDeliverable}
            onChange={(e) => setForm({ ...form, isDeliverable: e.target.checked })}
            className="mr-2"
          />
          <label htmlFor="isDeliverable" className="text-sm text-gray-700">배달 가능</label>
        </div>
        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}
