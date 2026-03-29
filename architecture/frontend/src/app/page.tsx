'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
}

export default function HomePage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Get user location with timeout
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setUserLocation({ lat: 33.3615, lng: 126.3098 });
        },
        { timeout: 5000 }
      );
    }

    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      console.log('Fetching restaurants...');
      const response = await fetch('/api/v1/restaurants');
      const data = await response.json();
      console.log('API response success:', data.success, 'count:', data.data?.length);
      
      if (data.success && data.data) {
        // Show all active restaurants - no distance filter
        const allRestaurants = data.data as Restaurant[];
        console.log('Setting restaurants:', allRestaurants.length);
        setRestaurants(allRestaurants);
      } else {
        console.error('API error:', data.error);
        setRestaurants([]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const isRestaurantOpen = (restaurant: Restaurant): { isOpen: boolean; message: string } => {
    // Check if restaurant is active
    if (!restaurant.isActive) {
      return { isOpen: false, message: '배달 가능한 시간이 아닙니다' };
    }

    // Check business status
    if (restaurant.businessStatus === 'closed') {
      return { isOpen: false, message: '배달 가능한 시간이 아닙니다' };
    }

    // Parse business hours
    if (restaurant.businessHours) {
      const hours = restaurant.businessHours.split('-');
      if (hours.length === 2) {
        // Use KST timezone for time comparison
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentTime = kstNow.getHours() * 60 + kstNow.getMinutes();

        const [openHour, openMin] = hours[0].split(':').map(Number);
        const [closeHour, closeMin] = hours[1].split(':').map(Number);

        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        // Handle late night (e.g., 22:00-02:00)
        if (closeTime < openTime) {
          // Crosses midnight
          if (currentTime >= openTime || currentTime < closeTime) {
            return { isOpen: true, message: '' };
          }
        } else {
          if (currentTime >= openTime && currentTime < closeTime) {
            return { isOpen: true, message: '' };
          }
        }

        return { isOpen: false, message: '배달 가능한 시간이 아닙니다' };
      }
    }

    return { isOpen: true, message: '' };
  };

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">식당 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">한경배달</h1>
              <p className="text-sm text-gray-500">제주 한경면 음식배달</p>
            </div>
            <Link
              href="/my-orders"
              className="flex items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              내주문 조회
            </Link>
          </div>
        </div>
      </header>

      {/* Restaurant List */}
      <main className="max-w-md mx-auto px-4 py-4">
        <div className="space-y-3">
          {restaurants.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">현재 배달 가능한 식당이 없습니다.</p>
            </div>
          ) : (
            restaurants.map((restaurant) => {
              const { isOpen, message } = isRestaurantOpen(restaurant);
              const distance = userLocation
                ? getDistance(
                    userLocation.lat,
                    userLocation.lng,
                    restaurant.latitude,
                    restaurant.longitude
                  ).toFixed(1)
                : null;

              return (
                <Link
                  key={restaurant.id}
                  href={isOpen ? `/restaurant/${restaurant.id}` : '#'}
                  className={`block bg-white rounded-lg shadow-sm p-4 ${
                    !isOpen ? 'opacity-60' : 'hover:shadow-md transition-shadow'
                  }`}
                  onClick={(e) => !isOpen && e.preventDefault()}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{restaurant.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {restaurant.category?.replace(/^음식점 > /, '') || '음식점'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {restaurant.businessHours || '영업시간 미설정'}
                      </p>
                    </div>
                    <div className="text-right">
                      {restaurant.rating && (
                        <div className="flex items-center text-sm">
                          <span className="text-yellow-500 mr-1">★</span>
                          <span className="text-gray-700">{restaurant.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {distance && (
                        <p className="text-xs text-gray-400 mt-1">{distance}km</p>
                      )}
                    </div>
                  </div>

                  {!isOpen && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                      <p className="text-xs text-red-600 font-medium">{message}</p>
                    </div>
                  )}

                  {restaurant.description && isOpen && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {restaurant.description}
                    </p>
                  )}

                  {isOpen && (
                    <div className="mt-2 flex items-center text-xs text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      배달 가능
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
