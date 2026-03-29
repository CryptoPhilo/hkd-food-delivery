'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  menus: MenuItem[];
}

export default function MenuManagementPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('');
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenus(selectedRestaurant);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch('/api/v1/admin/restaurants');
      const data = await response.json();
      if (data.success) {
        setRestaurants(data.data);
        if (data.data.length > 0) {
          setSelectedRestaurant(data.data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenus = async (restaurantId: string) => {
    try {
      const response = await fetch(`/api/v1/admin/restaurants/${restaurantId}/menus`);
      const data = await response.json();
      if (data.success) {
        setMenus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch menus:', error);
    }
  };

  const updateMenuImage = async (menuId: string, imageUrl: string) => {
    try {
      const response = await fetch(`/api/v1/admin/menus/${menuId}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await response.json();
      if (data.success) {
        setMenus(menus.map(m => m.id === menuId ? { ...m, imageUrl } : m));
        setEditingMenu(null);
        setNewImageUrl('');
      }
    } catch (error) {
      console.error('Failed to update menu image:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">메뉴 이미지 관리</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">식당 선택</label>
        <select
          value={selectedRestaurant}
          onChange={(e) => setSelectedRestaurant(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {selectedRestaurant && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이미지</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">메뉴명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menus.map((menu) => (
                <tr key={menu.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingMenu === menu.id ? (
                      <div className="w-32">
                        <input
                          type="text"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="이미지 URL"
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    ) : (
                      <img
                        src={menu.imageUrl || 'https://via.placeholder.com/100x100?text=No+Image'}
                        alt={menu.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{menu.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{menu.price.toLocaleString()}원</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {editingMenu === menu.id ? (
                      <div className="space-x-2">
                        <button
                          onClick={() => updateMenuImage(menu.id, newImageUrl)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => { setEditingMenu(null); setNewImageUrl(''); }}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingMenu(menu.id); setNewImageUrl(menu.imageUrl || ''); }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        이미지 변경
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
