'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  isAvailable: boolean;
  isActive: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  category?: string;
  businessStatus?: string;
  businessHours?: string;
  description?: string;
  imageUrl?: string;
  rating?: number;
  isActive: boolean;
  isDeliverable: boolean;
  latitude: number;
  longitude: number;
  menus: MenuItem[];
}

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

interface CartData {
  [restaurantId: string]: {
    restaurantName: string;
    items: CartItem[];
  };
}

export default function RestaurantPage() {
  const params = useParams();
  const restaurantId = params?.id as string;
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartData, setCartData] = useState<CartData>({});
  const [showClosedModal, setShowClosedModal] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    fetchRestaurant();
    loadCart();
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/v1/restaurants/${restaurantId}`);
      const data = await response.json();
      console.log('Restaurant data:', data);
      if (data.success) {
        setRestaurant(data.data);
        checkBusinessHours(data.data);
      } else {
        console.error('Failed to fetch restaurant:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCartData(JSON.parse(savedCart));
    }
  };

  const saveCart = (newCart: CartData) => {
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCartData(newCart);
  };

  const getCurrentCartItems = (): CartItem[] => {
    if (!restaurantId) return [];
    return cartData[restaurantId]?.items || [];
  };

  const checkBusinessHours = (rest: Restaurant): boolean => {
    if (!rest.isActive || rest.businessStatus === 'closed') {
      setShowClosedModal(true);
      return false;
    }

    if (rest.businessHours) {
      const hours = rest.businessHours.split('-');
      if (hours.length === 2) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const [openHour, openMin] = hours[0].split(':').map(Number);
        const [closeHour, closeMin] = hours[1].split(':').map(Number);

        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        if (closeTime < openTime) {
          if (currentTime >= openTime || currentTime < closeTime) {
            return true;
          }
        } else {
          if (currentTime >= openTime && currentTime < closeTime) {
            return true;
          }
        }

        setShowClosedModal(true);
        return false;
      }
    }

    return true;
  };

  const addToCart = (menu: MenuItem) => {
    const newCart = { ...cartData };
    if (!newCart[restaurantId]) {
      newCart[restaurantId] = { restaurantName: restaurant?.name || '', items: [] };
    }

    const existing = newCart[restaurantId].items.find((item) => item.menuId === menu.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      newCart[restaurantId].items.push({
        menuId: menu.id,
        name: menu.name,
        price: menu.price,
        quantity: 1,
        restaurantId,
        restaurantName: restaurant?.name || '',
      });
    }
    saveCart(newCart);
  };

  const removeFromCart = (menuId: string) => {
    const newCart = { ...cartData };
    if (newCart[restaurantId]) {
      const existing = newCart[restaurantId].items.find((item) => item.menuId === menuId);
      if (existing) {
        if (existing.quantity > 1) {
          existing.quantity -= 1;
        } else {
          newCart[restaurantId].items = newCart[restaurantId].items.filter(
            (item) => item.menuId !== menuId,
          );
          if (newCart[restaurantId].items.length === 0) {
            delete newCart[restaurantId];
          }
        }
      }
    }
    saveCart(newCart);
  };

  const getCartTotal = () => {
    let total = 0;
    for (const rid in cartData) {
      for (const item of cartData[rid].items) {
        total += item.price * item.quantity;
      }
    }
    return total;
  };

  const getCartCount = () => {
    let count = 0;
    for (const rid in cartData) {
      for (const item of cartData[rid].items) {
        count += item.quantity;
      }
    }
    return count;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">식당을 찾을 수 없습니다.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const availableMenus = restaurant.menus.filter((m) => m.isAvailable && m.isActive);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="p-2 -ml-2">
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900 flex-1 text-center pr-8">
              {restaurant.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-sm text-gray-500">
                {restaurant.category?.replace(/^음식점 > /, '') || '음식점'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                영업시간: {restaurant.businessHours || '미설정'}
              </p>
              {restaurant.phone && (
                <p className="text-sm text-gray-400">전화: {restaurant.phone}</p>
              )}
            </div>
            {restaurant.rating && (
              <div className="flex items-center">
                <span className="text-yellow-500 mr-1">★</span>
                <span className="text-gray-700 font-medium">{restaurant.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          {restaurant.description && (
            <p className="text-sm text-gray-600 mt-2">{restaurant.description}</p>
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-3">메뉴</h2>
        <div className="space-y-3">
          {availableMenus.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
              현재 주문 가능한 메뉴가 없습니다.
            </div>
          ) : (
            availableMenus.map((menu) => {
              const cartItem = getCurrentCartItems().find((c) => c.menuId === menu.id);
              return (
                <div key={menu.id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex justify-between items-start">
                    {(menu.imageUrl || menu.thumbnailUrl) && (
                      <img
                        src={menu.imageUrl || menu.thumbnailUrl}
                        alt={menu.name}
                        className="w-20 h-20 object-cover rounded-lg mr-3 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{menu.name}</h3>
                      {menu.description && (
                        <p className="text-sm text-gray-500 mt-1">{menu.description}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-900 mt-2">
                        {menu.price.toLocaleString()}원
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {cartItem ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromCart(menu.id)}
                            className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-4 text-center">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => addToCart(menu)}
                            className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(menu)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg"
                        >
                          담기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {getCartCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-md mx-auto px-4 py-3">
            <Link
              href={`/checkout?restaurant=${restaurantId}`}
              className="flex items-center justify-between bg-blue-600 text-white py-3 px-4 rounded-lg"
            >
              <div className="flex items-center">
                <span className="bg-white text-blue-600 text-xs font-bold px-2 py-1 rounded-full mr-2">
                  {getCartCount()}
                </span>
                <span>장바구니 보기</span>
              </div>
              <span className="font-semibold">{getCartTotal().toLocaleString()}원</span>
            </Link>
          </div>
        </div>
      )}

      {showClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => router.push('/')}
          ></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">배달 가능한 시간이 아닙니다</h2>
            <p className="text-gray-600 mb-4">
              {restaurant.name}님은 현재 주문 접수가 불가합니다.
              <br />
              영업시간: {restaurant.businessHours || '미설정'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium"
            >
              다른 식당 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
