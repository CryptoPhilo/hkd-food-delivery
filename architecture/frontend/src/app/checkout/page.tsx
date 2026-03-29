'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface CartItem {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

interface Restaurant {
  id: string;
  name: string;
  phone?: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadius?: number;
}

interface CartData {
  [restaurantId: string]: {
    restaurantName: string;
    items: CartItem[];
  };
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const restaurantId = searchParams.get('restaurant');

  const [cartData, setCartData] = useState<CartData>({});
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{ [id: string]: { lat: number; lng: number; name: string } }>({});
  const [deliveryLat, setDeliveryLat] = useState<number | null>(33.3615);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(126.3098);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerMemo, setCustomerMemo] = useState('');
  const [showPlatformClosedModal, setShowPlatformClosedModal] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }
    checkPlatformBusinessHours();
    fetchCurrentRestaurant();
    loadCart();
  }, [restaurantId]);

  if (!restaurantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">식당 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const checkPlatformBusinessHours = async () => {
    try {
      const response = await fetch('/api/v1/settings/platform-hours');
      const data = await response.json();
      if (data.success && data.data) {
        const { isOpen } = checkIfOpen(data.data.openTime, data.data.closeTime, data.data.isActive);
        if (!isOpen) {
          setShowPlatformClosedModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to check platform hours:', error);
    }
  };

  const checkIfOpen = (openTime: string, closeTime: string, isActive: boolean): { isOpen: boolean; message: string } => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);

    const open = openHour * 60 + openMin;
    const close = closeHour * 60 + closeMin;

    if (!isActive) {
      return { isOpen: false, message: '배달 가능한 시간이 아닙니다' };
    }

    if (close < open) {
      if (currentTime >= open || currentTime < close) {
        return { isOpen: true, message: '' };
      }
    } else {
      if (currentTime >= open && currentTime < close) {
        return { isOpen: true, message: '' };
      }
    }

    return { isOpen: false, message: '배달 가능한 시간이 아닙니다' };
  };

  const fetchCurrentRestaurant = async () => {
    try {
      const response = await fetch(`/api/v1/restaurants/${restaurantId}`);
      const data = await response.json();
      if (data.success) {
        setCurrentRestaurant(data.data);
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
      const cart = JSON.parse(savedCart);
      setCartData(cart);
      fetchRestaurantCoords(cart);
    }
  };

  const fetchRestaurantCoords = async (cart: CartData) => {
    const coords: { [id: string]: { lat: number; lng: number; name: string } } = {};
    for (const rid of Object.keys(cart)) {
      try {
        const response = await fetch(`/api/v1/restaurants/${rid}`);
        const data = await response.json();
        if (data.success && data.data) {
          coords[rid] = {
            lat: data.data.latitude,
            lng: data.data.longitude,
            name: data.data.name
          };
        }
      } catch (error) {
        console.error('Failed to fetch restaurant coords:', error);
      }
    }
    setRestaurantCoords(coords);
  };

  const saveCart = (newCart: CartData) => {
    localStorage.setItem('cart', JSON.stringify(newCart));
    setCartData(newCart);
  };

  const updateQuantity = (menuId: string, delta: number) => {
    const newCart = { ...cartData };
    for (const rid in newCart) {
      const item = newCart[rid].items.find(i => i.menuId === menuId);
      if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
          newCart[rid].items = newCart[rid].items.filter(i => i.menuId !== menuId);
          if (newCart[rid].items.length === 0) {
            delete newCart[rid];
          }
        }
        break;
      }
    }
    saveCart(newCart);
  };

  const removeItem = (menuId: string) => {
    const newCart = { ...cartData };
    for (const rid in newCart) {
      newCart[rid].items = newCart[rid].items.filter(i => i.menuId !== menuId);
      if (newCart[rid].items.length === 0) {
        delete newCart[rid];
      }
    }
    saveCart(newCart);
  };

  const getSubtotal = () => {
    let total = 0;
    for (const rid in cartData) {
      for (const item of cartData[rid].items) {
        total += item.price * item.quantity;
      }
    }
    return total;
  };

  const getRestaurantCount = () => {
    return Object.keys(cartData).length;
  };

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get distance surcharge based on closest restaurant
  const getDistanceSurcharge = (): { distance: number; surcharge: number; closestRestaurant: string } => {
    if (!deliveryLat || !deliveryLng || Object.keys(restaurantCoords).length === 0) {
      return { distance: 0, surcharge: 0, closestRestaurant: '' };
    }

    let minDistance = Infinity;
    let closestRestaurant = '';

    for (const [rid, coord] of Object.entries(restaurantCoords)) {
      const distance = calculateDistance(deliveryLat, deliveryLng, coord.lat, coord.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestRestaurant = coord.name;
      }
    }

    // Distance surcharge: 0-1km = 0원, 1-2km = 1,000원, 2-3km = 2,000원, 3km+ = 3,000원
    let surcharge = 0;
    if (minDistance > 1) surcharge = 1000;
    if (minDistance > 2) surcharge = 2000;
    if (minDistance > 3) surcharge = 3000;

    return { distance: minDistance, surcharge, closestRestaurant };
  };

  const getDeliveryFee = () => {
    const restaurantCount = getRestaurantCount();
    const BASE_FEE = 5000;
    const EXTRA_PER_RESTAURANT = 3000;
    const { surcharge } = getDistanceSurcharge();
    
    if (restaurantCount === 0) return 0;
    const restaurantFee = restaurantCount === 1 ? BASE_FEE : BASE_FEE + (restaurantCount - 1) * EXTRA_PER_RESTAURANT;
    return restaurantFee + surcharge;
  };

  const getDeliveryFeeBreakdown = () => {
    const restaurantCount = getRestaurantCount();
    const BASE_FEE = 5000;
    const EXTRA_PER_RESTAURANT = 3000;
    const { distance, surcharge, closestRestaurant } = getDistanceSurcharge();
    
    const restaurantFee = restaurantCount === 1 ? BASE_FEE : BASE_FEE + (restaurantCount - 1) * EXTRA_PER_RESTAURANT;
    
    return {
      baseFee: BASE_FEE,
      extraFee: restaurantCount > 1 ? (restaurantCount - 1) * EXTRA_PER_RESTAURANT : 0,
      surcharge,
      distance: distance.toFixed(1),
      closestRestaurant,
      total: restaurantFee + surcharge
    };
  };

  const getTotal = () => {
    return getSubtotal() + getDeliveryFee();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !deliveryAddress) {
      alert('전화번호와 배달 주소를 입력해주세요.');
      return;
    }

    if (Object.keys(cartData).length === 0) {
      alert('장바구니가 비어있습니다.');
      return;
    }

    setSubmitting(true);

    try {
      const restaurantIds = Object.keys(cartData);
      const createdOrders: { id: string; restaurantName: string }[] = [];

      for (const restaurantId of restaurantIds) {
        const orderData = {
          phone,
          name: name || null,
          restaurantId,
          items: cartData[restaurantId].items.map((item) => ({
            menuId: item.menuId,
            quantity: item.quantity,
          })),
          deliveryAddress,
          deliveryLat: deliveryLat || 33.3615,
          deliveryLng: deliveryLng || 126.3098,
          customerMemo: customerMemo || null,
        };

        console.log('Submitting order for', cartData[restaurantId].restaurantName, orderData);

        const response = await fetch('/api/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        const data = await response.json();
        console.log('Order response:', data);

        if (data.success) {
          createdOrders.push({
            id: data.data.id,
            restaurantName: cartData[restaurantId].restaurantName,
          });
        } else {
          const errorMsg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || '주문 실패');
          alert(`오류 (${cartData[restaurantId].restaurantName}): ${errorMsg}`);
          return;
        }
      }

      localStorage.removeItem('cart');
      alert(`${createdOrders.length}개 식당 주문이 완료되었습니다!`);
      
      if (createdOrders.length > 0) {
        router.push(`/order/${createdOrders[0].id}`);
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('주문 중 오류가 발생했습니다: ' + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const restaurantCount = getRestaurantCount();

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/')} className="p-2 -ml-2">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-gray-900">주문하기</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        <form onSubmit={handleSubmit}>
          {Object.keys(cartData).length > 0 ? (
            <div className="space-y-4 mb-6">
              {Object.entries(cartData).map(([rid, data]) => (
                <div key={rid} className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 border-b pb-2">
                    {data.restaurantName}
                  </h3>
                  <div className="space-y-3">
                    {data.items.map((item) => (
                      <div key={item.menuId} className="flex justify-between items-center">
                        <div className="flex-1">
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.menuId, -1)}
                            className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm"
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.menuId, 1)}
                            className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                          <span className="text-sm font-medium w-20 text-right">
                            {(item.price * item.quantity).toLocaleString()}원
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.menuId)}
                            className="text-red-500 text-xs ml-2"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500 mb-4">
              장바구니가 비어있습니다.
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">음식 금액</span>
                <span>{getSubtotal().toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">배달비</span>
                <span className="text-right">
                  {getDeliveryFeeBreakdown().baseFee.toLocaleString()}원
                  {getDeliveryFeeBreakdown().extraFee > 0 && (
                    <span className="text-gray-400"> + {getDeliveryFeeBreakdown().extraFee.toLocaleString()}원(추가)</span>
                  )}
                </span>
              </div>
              {getDeliveryFeeBreakdown().surcharge > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>거리 할증 ({getDeliveryFeeBreakdown().closestRestaurant}까지 {getDeliveryFeeBreakdown().distance}km)</span>
                  <span>+{getDeliveryFeeBreakdown().surcharge.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>총액</span>
                <span>{getTotal().toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full mb-3 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            + 계속 주문하기
          </button>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">고객 정보</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  required
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
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h2 className="font-semibold text-gray-900 mb-3">배달 정보</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  배달 주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="제주특별자치도 제주시 한경면..."
                  required
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
                <textarea
                  value={customerMemo}
                  onChange={(e) => setCustomerMemo(e.target.value)}
                  placeholder="배송 시 요청사항"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || Object.keys(cartData).length === 0}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {submitting ? '주문 처리중...' : '주문하기'}
          </button>
        </form>
      </main>

      {showPlatformClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">배달 가능한 시간이 아닙니다</h2>
            <p className="text-gray-600 mb-4">
              한경배달 플랫폼의 운영 시간이 아닙니다.
              <br />
              운영 시간에 다시 이용해주세요.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium"
            >
              메인으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
