'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { generateCategoryThumbnail, generateRestaurantThumbnail } from '@/utils/thumbnail';
import { getCategoryI18nKey } from '@/i18n/config';
import {
  calculateDistance as calcDist,
  isWithinDeliveryRange,
  DEFAULT_MAX_DELIVERY_DISTANCE_KM,
} from '@/utils/distance';

type StoreType = 'restaurant' | 'convenience_store';

interface Menu {
  id: string;
  name: string;
  price: number;
}

interface Restaurant {
  id: string;
  name: string;
  nameEn?: string;
  address: string;
  roadAddress?: string;
  phone?: string;
  category?: string;
  categoryEn?: string;
  businessStatus?: string;
  businessHours?: string;
  description?: string;
  descriptionEn?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  rating?: number;
  isActive: boolean;
  isDeliverable: boolean;
  isRecommended?: boolean;
  latitude: number;
  longitude: number;
  storeType?: string;
  brandName?: string;
  operatingHours24?: boolean;
  deliveryRadius?: number | null;
  menus?: Menu[];
}

interface Region {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  centerLatitude: number;
  centerLongitude: number;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
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
}

function findClosestRegion(lat: number, lng: number, regions: Region[]): Region | null {
  if (regions.length === 0) return null;
  let closest = regions[0];
  let minDist = getDistance(lat, lng, closest.centerLatitude, closest.centerLongitude);
  for (let i = 1; i < regions.length; i++) {
    const dist = getDistance(lat, lng, regions[i].centerLatitude, regions[i].centerLongitude);
    if (dist < minDist) {
      minDist = dist;
      closest = regions[i];
    }
  }
  return closest;
}

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const isKorean = locale === 'ko';
  const locName = (name: string, nameEn?: string) => (isKorean || !nameEn ? name : nameEn);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [noServiceInArea, setNoServiceInArea] = useState(false); // GPS 위치에 서비스 없음
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('hkd_delivery_address') || '';
    return '';
  });
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hkd_delivery_coords');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [geocoding, setGeocoding] = useState(false);
  const [activeTab, setActiveTab] = useState<StoreType>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hkd_active_tab');
      if (saved === 'restaurant' || saved === 'convenience_store') return saved;
    }
    return 'restaurant';
  });
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [regionDetected, setRegionDetected] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryOrderCounts, setCategoryOrderCounts] = useState<Record<string, number>>({});
  const [hotRestaurantIds, setHotRestaurantIds] = useState<Set<string>>(new Set());
  const [restaurantOrderCounts, setRestaurantOrderCounts] = useState<Record<string, number>>({});
  const [categoryThumbnails, setCategoryThumbnails] = useState<Record<string, string>>({});
  const [cartCount, setCartCount] = useState(0);

  // 카테고리 스크롤 오버레이 화살표
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 8);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (!el) return;
    // 이미지 로드 후 정확한 scrollWidth를 위해 약간 지연
    const timer = setTimeout(updateScrollArrows, 100);
    el.addEventListener('scroll', updateScrollArrows, { passive: true });
    window.addEventListener('resize', updateScrollArrows);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', updateScrollArrows);
      window.removeEventListener('resize', updateScrollArrows);
    };
  }, [updateScrollArrows, loading, restaurants, activeTab]);

  const scrollCategory = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' });
  };

  // 장바구니 수량 감지
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const saved = localStorage.getItem('cart');
        if (!saved) {
          setCartCount(0);
          return;
        }
        const cart = JSON.parse(saved);
        let count = 0;
        for (const rid in cart) {
          for (const item of cart[rid].items) {
            count += item.quantity;
          }
        }
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };
    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    window.addEventListener('focus', updateCartCount);
    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('focus', updateCartCount);
    };
  }, []);

  useEffect(() => {
    // 브라우저 자동 스크롤 복원 비활성화 + 맨 위로 이동
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    fetchRegions();
    fetchCategoryThumbnails();
  }, []);

  useEffect(() => {
    if (regions.length === 0) return;

    // 1. 저장된 지역이 있으면 즉시 사용
    const savedRegionId = sessionStorage.getItem('hkd_selected_region');
    if (savedRegionId) {
      const savedRegion = regions.find((r) => r.id === savedRegionId);
      if (savedRegion) {
        setCurrentRegion(savedRegion);
        setUserLocation({ lat: savedRegion.centerLatitude, lng: savedRegion.centerLongitude });
        setRegionDetected(true);
        return;
      }
    }

    // 2. GPS로 위치 감지하여 서비스 지역 확인
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          const closest = findClosestRegion(loc.lat, loc.lng, regions);
          if (closest) {
            const dist = getDistance(
              loc.lat,
              loc.lng,
              closest.centerLatitude,
              closest.centerLongitude,
            );
            if (dist > (closest as any).radiusKm || dist > 15) {
              // 가장 가까운 서비스 지역에서도 너무 멀면 → 서비스 지역 외
              setNoServiceInArea(true);
            } else {
              setCurrentRegion(closest);
              setUserLocation({ lat: closest.centerLatitude, lng: closest.centerLongitude });
            }
          }
          setRegionDetected(true);
        },
        () => {
          // GPS 실패 → 기본 지역으로 시작
          const defaultRegion = regions[0];
          setCurrentRegion(defaultRegion);
          setUserLocation({
            lat: defaultRegion.centerLatitude,
            lng: defaultRegion.centerLongitude,
          });
          setRegionDetected(true);
        },
        { timeout: 5000 },
      );
      // 5초 내 응답 없으면 기본 지역 표시 (timeout fallback)
      setTimeout(() => {
        setRegionDetected((prev) => {
          if (!prev) {
            const defaultRegion = regions[0];
            setCurrentRegion(defaultRegion);
            setUserLocation({
              lat: defaultRegion.centerLatitude,
              lng: defaultRegion.centerLongitude,
            });
            return true;
          }
          return prev;
        });
      }, 5500);
    } else {
      // Geolocation API 미지원
      const defaultRegion = regions[0];
      setCurrentRegion(defaultRegion);
      setUserLocation({ lat: defaultRegion.centerLatitude, lng: defaultRegion.centerLongitude });
      setRegionDetected(true);
    }
  }, [regions]);

  useEffect(() => {
    if (currentRegion) {
      sessionStorage.setItem('hkd_selected_region', currentRegion.id);
      fetchRestaurants(currentRegion.id);
    }
  }, [currentRegion]);

  useEffect(() => {
    sessionStorage.setItem('hkd_active_tab', activeTab);
  }, [activeTab]);

  const fetchRegions = async () => {
    try {
      const res = await fetch('/api/v1/restaurants/regions');
      const data = await res.json();
      if (data.success && data.data) setRegions(data.data);
    } catch (error) {
      console.error('Region fetch error:', error);
    }
  };

  const fetchCategoryThumbnails = async () => {
    try {
      const res = await fetch('/api/v1/thumbnails/categories');
      const data = await res.json();
      if (data.success && data.data) setCategoryThumbnails(data.data);
    } catch (error) {
      console.error('Category thumbnails fetch error:', error);
    }
  };

  const fetchRestaurants = async (regionId: string) => {
    setLoading(true);
    try {
      const [restRes, countRes, hotRes] = await Promise.all([
        fetch(`/api/v1/restaurants?regionId=${regionId}&limit=500`),
        fetch(`/api/v1/restaurants/category-order-counts?regionId=${regionId}`),
        fetch(`/api/v1/restaurants/weekly-hot?regionId=${regionId}`),
      ]);
      const data = await restRes.json();
      if (data.success && data.data) {
        setRestaurants(data.data as Restaurant[]);
      } else {
        setRestaurants([]);
      }
      const countData = await countRes.json();
      if (countData.success && countData.data) setCategoryOrderCounts(countData.data);
      const hotData = await hotRes.json();
      if (hotData.success && hotData.data) {
        setHotRestaurantIds(new Set(hotData.data.hotRestaurantIds || []));
        setRestaurantOrderCounts(hotData.data.orderCounts || {});
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && restaurants.length > 0) {
      const savedScroll = sessionStorage.getItem('hkd_scroll_position');
      const cameBack = sessionStorage.getItem('hkd_came_from_store');
      if (savedScroll && cameBack) {
        requestAnimationFrame(() => window.scrollTo(0, parseInt(savedScroll, 10)));
      }
      sessionStorage.removeItem('hkd_scroll_position');
      sessionStorage.removeItem('hkd_came_from_store');
    }
  }, [loading, restaurants]);

  const handleRegionChange = (regionId: string) => {
    const region = regions.find((r) => r.id === regionId);
    if (region) {
      sessionStorage.removeItem('hkd_scroll_position');
      setCurrentRegion(region);
      setUserLocation({ lat: region.centerLatitude, lng: region.centerLongitude });
      setNoServiceInArea(false); // 수동 선택 시 서비스 외 상태 해제
      setDeliveryCoords(null); // 주소 기준 초기화
      setDeliveryAddress('');
    }
  };

  // 배달 기준 주소 지오코딩
  const handleGeocodeAddress = async () => {
    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      alert(t('checkout.addressMinLength'));
      return;
    }
    setGeocoding(true);
    try {
      const res = await fetch(
        `/api/v1/restaurants/geocode?address=${encodeURIComponent(deliveryAddress)}`,
      );
      const data = await res.json();
      if (data.success && data.data) {
        const coords = { lat: data.data.latitude, lng: data.data.longitude };
        setDeliveryCoords(coords);
        setUserLocation(coords); // 거리 계산 기준점을 입력 주소로 변경
        // 체크아웃에서 사용할 수 있도록 sessionStorage에 저장
        sessionStorage.setItem('hkd_delivery_address', deliveryAddress);
        sessionStorage.setItem('hkd_delivery_coords', JSON.stringify(coords));
      } else {
        alert(t('checkout.addressNotFound'));
      }
    } catch (e) {
      console.error('Geocode error:', e);
    } finally {
      setGeocoding(false);
    }
  };

  const handleStoreClick = () => {
    sessionStorage.setItem('hkd_scroll_position', String(window.scrollY));
    sessionStorage.setItem('hkd_came_from_store', '1');
  };

  const filteredStores = restaurants.filter((r) => {
    const type = r.storeType || 'restaurant';
    return type === activeTab;
  });

  const groupedByCategory = filteredStores.reduce<Record<string, Restaurant[]>>((acc, store) => {
    const cat =
      activeTab === 'convenience_store'
        ? store.brandName || t('home.category.otherStore')
        : store.category?.replace(/^음식점 > /, '') || t('home.category.other');
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(store);
    return acc;
  }, {});

  const categoryNames = Object.keys(groupedByCategory).sort((a, b) => {
    const orderDiff = (categoryOrderCounts[b] || 0) - (categoryOrderCounts[a] || 0);
    if (orderDiff !== 0) return orderDiff;
    const storeDiff = groupedByCategory[b].length - groupedByCategory[a].length;
    return storeDiff !== 0 ? storeDiff : a.localeCompare(b, 'ko');
  });

  // DB 카테고리명(한국어) → 현재 locale로 번역
  const translateCategory = (koreanName: string): string => {
    const key = getCategoryI18nKey(koreanName);
    if (key) {
      try {
        return t(key);
      } catch {
        return koreanName;
      }
    }
    return koreanName;
  };

  const isRestaurantOpen = (restaurant: Restaurant): { isOpen: boolean; message: string } => {
    if (!restaurant.isActive) return { isOpen: false, message: t('common.notDeliveryTime') };
    if (restaurant.businessStatus === 'closed')
      return { isOpen: false, message: t('common.notDeliveryTime') };
    if (restaurant.operatingHours24) return { isOpen: true, message: '' };
    if (restaurant.businessHours) {
      const hours = restaurant.businessHours.split('-');
      if (hours.length === 2) {
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentTime = kstNow.getHours() * 60 + kstNow.getMinutes();
        const [openHour, openMin] = hours[0].split(':').map(Number);
        const [closeHour, closeMin] = hours[1].split(':').map(Number);
        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;
        if (closeTime < openTime) {
          if (currentTime >= openTime || currentTime < closeTime)
            return { isOpen: true, message: '' };
        } else {
          if (currentTime >= openTime && currentTime < closeTime)
            return { isOpen: true, message: '' };
        }
        return { isOpen: false, message: t('common.notDeliveryTime') };
      }
    }
    return { isOpen: true, message: '' };
  };

  if (loading && !noServiceInArea) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-airbnb-red border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-airbnb-gray text-[15px] font-medium">
            {!regionDetected ? t('home.status.detectingLocation') : t('home.status.loadingInfo')}
          </p>
        </div>
      </div>
    );
  }

  // 서비스 지역 외 안내 화면
  if (noServiceInArea && !currentRegion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <svg
            className="w-16 h-16 text-airbnb-gray mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-airbnb-black mb-2">
            {t('home.noService.title')}
          </h2>
          <p className="text-airbnb-gray text-sm mb-6">{t('home.noService.description')}</p>
          <div className="space-y-2">
            {regions.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRegionChange(r.id)}
                className="w-full py-3 px-4 rounded-airbnb-sm border border-airbnb-divider text-left hover:bg-airbnb-surface transition-colors"
              >
                <span className="font-medium text-airbnb-black">{r.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-airbnb-divider">
        <div className="max-w-md mx-auto px-5 py-4">
          {/* Top bar */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-[22px] font-bold text-airbnb-black tracking-airbnb-tight">
                {t('home.title')}
              </h1>
              {currentRegion && (
                <div className="flex items-center gap-1 mt-0.5">
                  <svg
                    className="w-4 h-4 text-airbnb-gray"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {regions.length > 1 ? (
                    <select
                      value={currentRegion.id}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="text-sm text-airbnb-gray bg-transparent border-none p-0 pr-5 focus:ring-0 cursor-pointer font-medium"
                    >
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-airbnb-gray font-medium">{currentRegion.name}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              {/* Cart Button (Airbnb circle style) */}
              <Link href="/checkout" className="relative airbnb-circle-btn w-10 h-10">
                <svg
                  className="w-5 h-5 text-airbnb-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-airbnb-red text-white text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
              {/* My Orders Button */}
              <Link href="/my-orders" className="airbnb-circle-btn w-10 h-10">
                <svg
                  className="w-5 h-5 text-airbnb-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* ── 배달 기준 주소 입력 ── */}
          <div className="mt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  setDeliveryCoords(null);
                }}
                placeholder={t('home.addressInput.placeholder')}
                className="flex-1 px-3 py-2 text-sm border border-airbnb-divider rounded-airbnb-sm focus:outline-none focus:border-airbnb-black"
              />
              <button
                onClick={handleGeocodeAddress}
                disabled={geocoding || !deliveryAddress.trim()}
                className="px-3 py-2 text-sm font-medium bg-airbnb-black text-white rounded-airbnb-sm disabled:opacity-40 whitespace-nowrap"
              >
                {geocoding ? '...' : t('home.addressInput.button')}
              </button>
            </div>
            {deliveryCoords && (
              <p className="text-xs text-airbnb-green mt-1 font-medium">
                ✓ {t('home.addressInput.set')}
              </p>
            )}
          </div>

          {/* ── Store Type Tab Pills ── */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveTab('restaurant')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-airbnb-sm text-[15px] font-semibold transition-all duration-200 ${
                activeTab === 'restaurant'
                  ? 'bg-airbnb-black text-white'
                  : 'bg-airbnb-surface text-airbnb-gray'
              }`}
            >
              <span>🍽️</span> {t('home.tabs.restaurant')}
            </button>
            <button
              onClick={() => setActiveTab('convenience_store')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-airbnb-sm text-[15px] font-semibold transition-all duration-200 ${
                activeTab === 'convenience_store'
                  ? 'bg-airbnb-black text-white'
                  : 'bg-airbnb-surface text-airbnb-gray'
              }`}
            >
              <span>🏪</span> {t('home.tabs.convenienceStore')}
            </button>
          </div>
        </div>

        {/* ── Category Horizontal Scroll (Airbnb style, inside sticky header) ── */}
        {categoryNames.length > 0 && (
          <div className="max-w-md mx-auto px-5 pt-2 pb-1 relative">
            <div ref={categoryScrollRef} className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-2">
                {categoryNames.map((catName) => {
                  const isActive = expandedCategory === catName;
                  return (
                    <div
                      key={catName}
                      onClick={() => setExpandedCategory(isActive ? null : catName)}
                      className="flex flex-col items-center min-w-[64px] cursor-pointer transition-opacity duration-200"
                      style={{ opacity: expandedCategory && !isActive ? 0.5 : 1 }}
                    >
                      <div
                        className={`w-14 h-14 rounded-airbnb-md overflow-hidden border-2 transition-all duration-200 ${isActive ? 'border-airbnb-black' : 'border-transparent'}`}
                      >
                        <img
                          src={
                            categoryThumbnails[catName] ||
                            generateCategoryThumbnail(translateCategory(catName), catName)
                          }
                          alt={translateCategory(catName)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span
                        className={`text-xs mt-1.5 pb-0.5 transition-all duration-200 ${isActive ? 'font-bold text-airbnb-black border-b-2 border-airbnb-black' : 'font-medium text-airbnb-gray'}`}
                      >
                        {translateCategory(catName)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 왼쪽 오버레이 화살표 */}
            {showLeftArrow && (
              <button
                onClick={() => scrollCategory('left')}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-10"
                aria-label="스크롤 왼쪽"
              >
                <div className="w-7 h-7 rounded-full bg-white/90 shadow-airbnb-card flex items-center justify-center border border-airbnb-divider">
                  <svg
                    className="w-4 h-4 text-airbnb-black"
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
                </div>
              </button>
            )}

            {/* 오른쪽 오버레이 화살표 */}
            {showRightArrow && (
              <button
                onClick={() => scrollCategory('right')}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-10"
                aria-label="스크롤 오른쪽"
              >
                <div className="w-7 h-7 rounded-full bg-white/90 shadow-airbnb-card flex items-center justify-center border border-airbnb-divider">
                  <svg
                    className="w-4 h-4 text-airbnb-black"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Store List ── */}
      <main className="max-w-md mx-auto px-5 py-4 pb-24">
        <div className="space-y-3">
          {filteredStores.length === 0 ? (
            <div className="airbnb-card p-8 text-center">
              <p className="text-airbnb-gray text-[15px]">
                {activeTab === 'restaurant'
                  ? t('home.empty.noRestaurants')
                  : t('home.empty.noStores')}
              </p>
            </div>
          ) : (
            categoryNames.map((catName) => {
              const stores = groupedByCategory[catName];
              const isExpanded = expandedCategory === catName;
              const openCount = stores.filter((s) => isRestaurantOpen(s).isOpen).length;

              // 카테고리 스크롤 필터링 모드에서는 선택된 카테고리만 표시
              if (expandedCategory && !isExpanded) return null;

              return (
                <div key={catName} className="airbnb-card overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : catName)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-airbnb-surface/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          categoryThumbnails[catName] ||
                          generateCategoryThumbnail(translateCategory(catName), catName)
                        }
                        alt={translateCategory(catName)}
                        className="w-[52px] h-[36px] rounded-airbnb-sm object-cover flex-shrink-0"
                      />
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-base font-semibold text-airbnb-black">
                          {translateCategory(catName)}
                        </h3>
                        <span className="text-[13px] text-airbnb-disabled">
                          {t('common.count', { n: stores.length })}
                        </span>
                        {openCount > 0 && (
                          <span className="airbnb-badge bg-airbnb-green-bg text-airbnb-green">
                            {t('common.deliveryAvailable', { n: openCount })}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-airbnb-gray transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Expanded Restaurant List */}
                  {isExpanded && (
                    <div className="border-t border-airbnb-divider">
                      {[...stores]
                        .sort((a, b) => {
                          const recA = a.isRecommended ? 1 : 0;
                          const recB = b.isRecommended ? 1 : 0;
                          if (recB !== recA) return recB - recA;
                          const hotA = hotRestaurantIds.has(a.id) ? 1 : 0;
                          const hotB = hotRestaurantIds.has(b.id) ? 1 : 0;
                          if (hotB !== hotA) return hotB - hotA;
                          return (
                            (restaurantOrderCounts[b.id] || 0) - (restaurantOrderCounts[a.id] || 0)
                          );
                        })
                        .map((store) => {
                          const { isOpen } = isRestaurantOpen(store);
                          const distanceNum = userLocation
                            ? calcDist(
                                userLocation.lat,
                                userLocation.lng,
                                store.latitude,
                                store.longitude,
                              )
                            : null;
                          const distance = distanceNum !== null ? distanceNum.toFixed(1) : null;
                          const canDeliver =
                            distanceNum !== null
                              ? isWithinDeliveryRange(distanceNum, store.deliveryRadius)
                              : true; // 거리 모를 때는 일단 허용
                          const isConvenience = activeTab === 'convenience_store';
                          const detailUrl = isConvenience
                            ? `/store/${store.id}`
                            : `/restaurant/${store.id}`;
                          const isHot = hotRestaurantIds.has(store.id);

                          return (
                            <Link
                              key={store.id}
                              href={isOpen ? detailUrl : '#'}
                              className={`block px-4 py-3 border-b border-airbnb-divider last:border-b-0 ${
                                !isOpen
                                  ? 'opacity-40'
                                  : 'hover:bg-airbnb-surface/50 transition-colors'
                              }`}
                              onClick={(e) => {
                                if (!isOpen) {
                                  e.preventDefault();
                                } else {
                                  handleStoreClick();
                                }
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={
                                    store.thumbnailUrl ||
                                    generateRestaurantThumbnail(
                                      store.name,
                                      store.category,
                                      store.menus?.map((m) => m.name),
                                    )
                                  }
                                  alt={store.name}
                                  className="w-[52px] h-[36px] rounded-airbnb-sm object-cover flex-shrink-0 mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-medium text-airbnb-black truncate text-[15px]">
                                      {locName(store.name, store.nameEn)}
                                    </h4>
                                    {store.isRecommended && (
                                      <span className="airbnb-badge bg-airbnb-yellow-bg text-airbnb-yellow-text whitespace-nowrap flex-shrink-0">
                                        {t('common.recommended')}
                                      </span>
                                    )}
                                    {isHot && (
                                      <span className="airbnb-badge bg-red-50 text-airbnb-red whitespace-nowrap flex-shrink-0">
                                        Hot
                                      </span>
                                    )}
                                    {isConvenience && store.brandName && (
                                      <span className="airbnb-badge bg-airbnb-green-bg text-airbnb-green whitespace-nowrap flex-shrink-0">
                                        {store.brandName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <svg
                                      className="w-3.5 h-3.5 text-airbnb-gray"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                                      <path d="M12 6v6l4 2" strokeLinecap="round" strokeWidth="2" />
                                    </svg>
                                    <p className="text-xs text-airbnb-gray">
                                      {store.operatingHours24
                                        ? t('common.open24h')
                                        : store.businessHours || t('common.businessHoursNotSet')}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-2.5 flex-shrink-0">
                                  {isConvenience && store.operatingHours24 && (
                                    <span className="airbnb-badge bg-airbnb-blue-bg text-airbnb-blue-text">
                                      24H
                                    </span>
                                  )}
                                  {distance && (
                                    <span
                                      className={`text-xs font-medium ${canDeliver ? 'text-airbnb-gray' : 'text-airbnb-red'}`}
                                    >
                                      {distance}km{!canDeliver && ` (${t('common.outOfRange')})`}
                                    </span>
                                  )}
                                  {isOpen ? (
                                    <span className="w-2 h-2 bg-airbnb-green rounded-full flex-shrink-0"></span>
                                  ) : (
                                    <span className="text-xs text-airbnb-red font-medium">
                                      {t('common.preparing')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {store.description && isOpen && (
                                <p className="text-[13px] text-airbnb-gray mt-1 ml-[64px] line-clamp-1">
                                  {store.description}
                                </p>
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
