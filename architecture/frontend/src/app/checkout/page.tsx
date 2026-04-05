'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import PhoneInput from '@/components/PhoneInput';
import { getPortOneLocale } from '@/i18n/config';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth, getAccessToken } from '@/utils/auth';
import {
  calculateDistance as calcDist,
  isWithinDeliveryRange,
  DEFAULT_MAX_DELIVERY_DISTANCE_KM,
} from '@/utils/distance';

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

const PORTONE_STORE_ID = 'store-9c0e8f57-8f22-4f14-93f1-5a8dd5eed744';
const PORTONE_CHANNEL_KEY = 'channel-key-da039be4-ed37-4271-9459-07add1e42f20';

function CheckoutContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAuthenticated, onPhoneVerified } = useAuth();
  const restaurantId = searchParams.get('restaurant');

  const [cartData, setCartData] = useState<CartData>({});
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{
    [id: string]: { lat: number; lng: number; name: string; deliveryRadius?: number | null };
  }>({});
  const [deliveryLat, setDeliveryLat] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hkd_delivery_coords');
      if (saved) {
        try {
          return JSON.parse(saved).lat;
        } catch {}
      }
    }
    return null;
  });
  const [deliveryLng, setDeliveryLng] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hkd_delivery_coords');
      if (saved) {
        try {
          return JSON.parse(saved).lng;
        } catch {}
      }
    }
    return null;
  });
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // PortOne V2 SDK 로드 — polling 방식으로 안정적 감지
  useEffect(() => {
    // 이미 로드된 경우
    if ((window as any).PortOne) {
      setSdkLoaded(true);
      return;
    }

    // script 태그가 없으면 추가
    if (!document.querySelector('script[src*="portone.io"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // PortOne 전역 객체가 준비될 때까지 polling (스크립트 로드 + 파싱 완료 대기)
    let attempts = 0;
    const maxAttempts = 100; // 100 * 200ms = 20초
    const poll = setInterval(() => {
      attempts++;
      if ((window as any).PortOne) {
        clearInterval(poll);
        console.log(`[PortOne] SDK ready after ${attempts * 200}ms`);
        setSdkLoaded(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(poll);
        console.error('[PortOne] SDK load timeout after 20s');
      }
    }, 200);

    return () => clearInterval(poll);
  }, []);

  // localStorage에서 배달 정보 복원 (모바일 결제 리다이렉트 시 sessionStorage 손실 방지)
  const savedInfo =
    typeof window !== 'undefined'
      ? localStorage.getItem('hkd_checkout_info') || sessionStorage.getItem('hkd_checkout_info')
      : null;
  const parsed = savedInfo ? JSON.parse(savedInfo) : {};

  const [phone, setPhone] = useState(
    parsed.phone || (typeof window !== 'undefined' ? localStorage.getItem('hkd_phone') : '') || '',
  );
  const [name, setName] = useState(parsed.name || '');
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    // 목록에서 설정한 주소가 있으면 우선 사용
    if (typeof window !== 'undefined') {
      const fromHome = sessionStorage.getItem('hkd_delivery_address');
      if (fromHome) return fromHome;
    }
    return parsed.deliveryAddress || '';
  });
  const [customerMemo, setCustomerMemo] = useState(parsed.customerMemo || '');
  const [showPlatformClosedModal, setShowPlatformClosedModal] = useState(false);
  const [hasAdultItems, setHasAdultItems] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CARD'>('CARD');

  // 입력값 변경 시 localStorage + sessionStorage 모두 저장
  useEffect(() => {
    const infoJson = JSON.stringify({
      phone,
      name,
      deliveryAddress,
      customerMemo,
    });
    localStorage.setItem('hkd_checkout_info', infoJson);
    sessionStorage.setItem('hkd_checkout_info', infoJson);
  }, [phone, name, deliveryAddress, customerMemo]);

  // 주소 변경 시 좌표 초기화 (재계산 필요 표시)
  const prevAddressRef = useRef(deliveryAddress);
  useEffect(() => {
    if (deliveryAddress !== prevAddressRef.current) {
      setDeliveryLat(null);
      setDeliveryLng(null);
      prevAddressRef.current = deliveryAddress;
    }
  }, [deliveryAddress]);

  const [geocoding, setGeocoding] = useState(false);
  const calculateSurcharge = async () => {
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
        const newLat = data.data.latitude;
        const newLng = data.data.longitude;
        setDeliveryLat(newLat);
        setDeliveryLng(newLng);

        // 주소 지오코딩 직후 배달 가능 여부 사전 검증
        for (const [rid, coord] of Object.entries(restaurantCoords)) {
          if (!Object.keys(cartData).includes(rid)) continue;
          const dist = calcDist(newLat, newLng, coord.lat, coord.lng);
          const maxDist = coord.deliveryRadius ?? DEFAULT_MAX_DELIVERY_DISTANCE_KM;
          if (!isWithinDeliveryRange(dist, coord.deliveryRadius)) {
            alert(
              t('common.exceedsDeliveryRange', {
                name: cartData[rid]?.restaurantName || coord.name,
                max: maxDist.toFixed(0),
                dist: dist.toFixed(1),
              }),
            );
            break;
          }
        }
      } else {
        alert(t('checkout.addressNotFound'));
      }
    } catch (e) {
      console.error('Geocode error:', e);
      alert(t('checkout.distanceError'));
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    checkPlatformBusinessHours();
    loadCart();
    if (restaurantId) {
      fetchCurrentRestaurant();
    } else {
      setLoading(false);
    }
  }, [restaurantId]);

  const checkPlatformBusinessHours = async () => {
    try {
      const response = await fetch('/api/v1/settings/platform-hours');
      const data = await response.json();
      if (data.success && data.data) {
        const { isOpen } = checkIfOpen(
          data.data.openTime,
          data.data.closeTime,
          data.data.isActive,
          data.data.closedDays,
        );
        if (!isOpen) {
          setShowPlatformClosedModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to check platform hours:', error);
    }
  };

  const checkIfOpen = (
    openTime: string,
    closeTime: string,
    isActive: boolean,
    closedDays?: string[],
  ): { isOpen: boolean; message: string } => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [openHour, openMin] = openTime.split(':').map(Number);
    const [closeHour, closeMin] = closeTime.split(':').map(Number);

    const open = openHour * 60 + openMin;
    const close = closeHour * 60 + closeMin;

    if (!isActive) {
      return { isOpen: false, message: t('common.notDeliveryTime') };
    }

    // 정기 휴무일 체크
    if (closedDays && closedDays.length > 0) {
      const dayKeyMap: Record<number, string> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
      };
      const todayKey = dayKeyMap[now.getDay()];
      if (closedDays.includes(todayKey)) {
        return { isOpen: false, message: t('common.closedToday') };
      }
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

    return { isOpen: false, message: t('common.notDeliveryTime') };
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

      let adultFound = false;
      for (const rid in cart) {
        for (const item of cart[rid].items) {
          if (item.requiresAgeVerification && item.ageRestriction === 'adult') {
            adultFound = true;
            break;
          }
        }
        if (adultFound) break;
      }
      setHasAdultItems(adultFound);
    }
  };

  const fetchRestaurantCoords = async (cart: CartData) => {
    const coords: {
      [id: string]: { lat: number; lng: number; name: string; deliveryRadius?: number | null };
    } = {};
    for (const rid of Object.keys(cart)) {
      try {
        const response = await fetch(`/api/v1/restaurants/${rid}`);
        const data = await response.json();
        if (data.success && data.data) {
          coords[rid] = {
            lat: data.data.latitude,
            lng: data.data.longitude,
            name: data.data.name,
            deliveryRadius: data.data.deliveryRadius ?? null,
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
      const item = newCart[rid].items.find((i) => i.menuId === menuId);
      if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
          newCart[rid].items = newCart[rid].items.filter((i) => i.menuId !== menuId);
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
      newCart[rid].items = newCart[rid].items.filter((i) => i.menuId !== menuId);
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

  // 공용 유틸리티 사용 (utils/distance.ts)
  const calculateDistance = calcDist;

  const getDistanceSurcharge = (): {
    distance: number;
    surcharge: number;
    closestRestaurant: string;
  } => {
    if (!deliveryLat || !deliveryLng || Object.keys(restaurantCoords).length === 0) {
      return { distance: 0, surcharge: 0, closestRestaurant: '' };
    }

    // 현재 장바구니에 있는 음식점만 대상으로 계산
    const activeRestaurantIds = Object.keys(cartData);
    if (activeRestaurantIds.length === 0) {
      return { distance: 0, surcharge: 0, closestRestaurant: '' };
    }

    let minDistance = Infinity;
    let closestRestaurant = '';

    for (const [rid, coord] of Object.entries(restaurantCoords)) {
      if (!activeRestaurantIds.includes(rid)) continue;
      const distance = calculateDistance(deliveryLat, deliveryLng, coord.lat, coord.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestRestaurant = coord.name;
      }
    }

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
    const restaurantFee =
      restaurantCount === 1 ? BASE_FEE : BASE_FEE + (restaurantCount - 1) * EXTRA_PER_RESTAURANT;
    return restaurantFee + surcharge;
  };

  const getDeliveryFeeBreakdown = () => {
    const restaurantCount = getRestaurantCount();
    const BASE_FEE = 5000;
    const EXTRA_PER_RESTAURANT = 3000;
    const { distance, surcharge, closestRestaurant } = getDistanceSurcharge();

    const restaurantFee =
      restaurantCount === 1 ? BASE_FEE : BASE_FEE + (restaurantCount - 1) * EXTRA_PER_RESTAURANT;

    return {
      baseFee: BASE_FEE,
      extraFee: restaurantCount > 1 ? (restaurantCount - 1) * EXTRA_PER_RESTAURANT : 0,
      surcharge,
      distance: distance.toFixed(1),
      closestRestaurant,
      total: restaurantFee + surcharge,
    };
  };

  const getTotal = () => {
    return getSubtotal() + getDeliveryFee();
  };

  // ============================================
  // PortOne V2 결제 처리
  // ============================================
  const handlePayment = async () => {
    if (!phone || !deliveryAddress) {
      alert(t('checkout.alert.enterPhoneAndAddress'));
      return;
    }
    if (!deliveryLat || !deliveryLng) {
      alert(t('checkout.alert.calculateFirst'));
      return;
    }
    if (Object.keys(cartData).length === 0) {
      alert(t('checkout.alert.emptyCart'));
      return;
    }

    // 결제 전 모든 식당의 배달 가능 여부 사전 검증 (식당별 deliveryRadius 활용)
    for (const rid of Object.keys(cartData)) {
      const coord = restaurantCoords[rid];
      if (coord && deliveryLat && deliveryLng) {
        const dist = calculateDistance(deliveryLat, deliveryLng, coord.lat, coord.lng);
        const maxDist = coord.deliveryRadius ?? DEFAULT_MAX_DELIVERY_DISTANCE_KM;
        if (!isWithinDeliveryRange(dist, coord.deliveryRadius)) {
          alert(
            t('common.exceedsDeliveryRange', {
              name: cartData[rid].restaurantName,
              max: maxDist.toFixed(0),
              dist: dist.toFixed(1),
            }),
          );
          return;
        }
      }
    }
    if (!sdkLoaded) {
      alert(t('checkout.alert.moduleLoading'));
      return;
    }

    const PortOne = (window as any).PortOne;
    if (!PortOne) {
      alert(t('checkout.alert.moduleLoadFailed'));
      return;
    }

    setSubmitting(true);

    try {
      const totalAmount = Math.floor(getTotal());
      const paymentId = `payment-${Date.now()}`;
      const restaurantNames = Object.values(cartData).map((d) => d.restaurantName);
      const orderName =
        restaurantNames.length === 1
          ? restaurantNames[0]
          : `${restaurantNames[0]} 외 ${restaurantNames.length - 1}건`;
      const cleanPhone = phone.replace(/-/g, '');

      // PortOne V2 결제창 호출 (KG이니시스)
      // 공식 문서 최소 파라미터만 사용
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const paymentParams: Record<string, any> = {
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId,
        orderName,
        totalAmount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        locale: getPortOneLocale(locale),
        redirectUrl: `${window.location.origin}/checkout/complete`,
        customer: {
          fullName: name || '고객',
          phoneNumber: cleanPhone,
          email: cleanPhone + '@guest.hkd.kr',
        },
      };

      // 모바일 리다이렉트 복귀 시 사용할 결제 정보 저장 (localStorage 사용 — 모바일 리다이렉트 시 sessionStorage 손실 방지)
      const deliveryFee = getDeliveryFee();
      const paymentInfoJson = JSON.stringify({
        paymentId,
        totalAmount,
        deliveryLat,
        deliveryLng,
        deliveryFee,
      });
      localStorage.setItem('hkd_payment_info', paymentInfoJson);
      sessionStorage.setItem('hkd_payment_info', paymentInfoJson);

      console.log('[PortOne] 결제 요청:', JSON.stringify(paymentParams, null, 2));

      let response: any;
      try {
        response = await PortOne.requestPayment(paymentParams);
      } catch (sdkError: any) {
        // SDK가 예외를 던진 경우 — 상세 에러 정보 표시
        const errDetail = JSON.stringify(sdkError, Object.getOwnPropertyNames(sdkError), 2);
        console.error('[PortOne] SDK 예외:', errDetail);
        alert(
          `[SDK 에러]\n${sdkError?.message || sdkError}\n\n[상세]\n${errDetail?.slice(0, 500)}\n\n[파라미터]\n${JSON.stringify(paymentParams)}`,
        );
        setSubmitting(false);
        return;
      }

      console.log('[PortOne] 결제 응답:', JSON.stringify(response, null, 2));

      // 결제 실패 또는 사용자 취소
      if (response?.code) {
        const errCode = response.code || '';
        const errMsg = response.message || '';
        console.error('[PortOne] 결제 실패:', errCode, errMsg);

        if (errCode === 'USER_CANCEL' || errMsg.includes('취소')) {
          alert(t('checkout.alert.paymentCancelled'));
        } else {
          alert(t('checkout.alert.paymentError', { errMsg: errMsg || errCode, errCode }));
        }
        setSubmitting(false);
        return;
      }

      // 결제 성공 → 서버에 결제 검증 + 주문 생성
      await createOrdersWithPayment(paymentId, totalAmount);
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(t('checkout.alert.paymentException', { error: error.message || '알 수 없는 오류' }));
      setSubmitting(false);
    }
  };

  // 결제 취소 헬퍼
  const cancelPayment = async (paymentId: string, amount: number, reason: string) => {
    try {
      const res = await fetch('/api/v1/payments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, amount, reason }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('결제 취소 실패:', data.error);
      }
    } catch (e) {
      console.error('결제 취소 요청 오류:', e);
    }
  };

  // 결제 완료 후 서버에 주문 생성
  const createOrdersWithPayment = async (paymentId: string, paidAmount: number) => {
    try {
      // 1. 서버에서 결제 검증
      const verifyResponse = await fetch('/api/v1/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, amount: paidAmount }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        alert(t('checkout.alert.verifyFailed', { error: verifyData.error || '' }));
        setSubmitting(false);
        return;
      }

      // 2. 각 식당별 주문 생성
      const restaurantIds = Object.keys(cartData);
      const createdOrders: { id: string; restaurantName: string }[] = [];

      // 복수 식당 주문인 경우 deliveryGroupId 생성
      const deliveryGroupId = restaurantIds.length > 1 ? crypto.randomUUID() : undefined;

      const totalDeliveryFee = getDeliveryFee();
      for (let i = 0; i < restaurantIds.length; i++) {
        const rid = restaurantIds[i];
        // 첫 번째 식당에 전체 배달비 할당, 나머지는 0
        const orderDeliveryFee = i === 0 ? totalDeliveryFee : 0;
        const orderData = {
          phone: phone.replace(/-/g, ''),
          name: name || null,
          restaurantId: rid,
          items: cartData[rid].items.map((item) => ({
            menuId: item.menuId,
            quantity: item.quantity,
          })),
          deliveryAddress,
          deliveryLat: deliveryLat || 33.3615,
          deliveryLng: deliveryLng || 126.3098,
          customerMemo: customerMemo || null,
          paymentId,
          paymentMethod,
          deliveryFee: orderDeliveryFee,
          locale,
          deliveryGroupId,
        };

        const response = await fetchWithAuth('/api/v1/orders', {
          method: 'POST',
          body: JSON.stringify(orderData),
        });

        const data = await response.json();

        if (data.success) {
          createdOrders.push({
            id: data.data.id,
            restaurantName: cartData[rid].restaurantName,
          });
        } else {
          const details = data.details
            ? ` [${Array.isArray(data.details) ? data.details.join(', ') : data.details}]`
            : '';
          const errorMsg =
            (typeof data.error === 'string'
              ? data.error
              : data.error?.message || JSON.stringify(data.error) || '주문 실패') + details;
          // 주문 생성 실패 → 결제 자동 취소
          await cancelPayment(paymentId, paidAmount, `주문 생성 실패: ${errorMsg}`);
          alert(t('checkout.alert.orderFailedRefund', { error: errorMsg }));
          setSubmitting(false);
          return;
        }
      }

      localStorage.removeItem('cart');
      localStorage.setItem('hkd_phone', phone.replace(/-/g, ''));
      localStorage.removeItem('hkd_checkout_info');
      localStorage.removeItem('hkd_payment_info');
      sessionStorage.removeItem('hkd_checkout_info');
      sessionStorage.removeItem('hkd_payment_info');
      alert(t('checkout.alert.orderSuccess'));

      if (createdOrders.length > 0) {
        router.push(`/order/${createdOrders[0].id}`);
      }
    } catch (error) {
      console.error('Order error:', error);
      // 예외 발생 시에도 결제 취소 시도
      await cancelPayment(paymentId, paidAmount, '주문 처리 중 오류');
      alert(t('checkout.alert.orderErrorRefund', { error: (error as Error).message }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red"></div>
      </div>
    );
  }

  const restaurantCount = getRestaurantCount();

  return (
    <div className="min-h-screen bg-white pb-32">
      <header className="bg-white border-b border-airbnb-divider sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/')}
              className="airbnb-circle-btn w-9 h-9 flex items-center justify-center"
            >
              <svg
                className="w-6 h-6 text-airbnb-black"
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
            <h1 className="text-lg font-bold text-airbnb-black tracking-airbnb-tight">
              {t('checkout.title')}
            </h1>
            <div className="w-10"></div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        {Object.keys(cartData).length > 0 ? (
          <div className="space-y-4 mb-6">
            {Object.entries(cartData).map(([rid, data]) => (
              <div key={rid} className="airbnb-card rounded-airbnb-lg p-5">
                <h3 className="font-semibold text-airbnb-black mb-3 border-b border-airbnb-divider pb-2">
                  {data.restaurantName}
                </h3>
                <div className="space-y-3">
                  {data.items.map((item) => (
                    <div key={item.menuId} className="flex justify-between items-center">
                      <div className="flex-1">
                        <span className="text-sm text-airbnb-black">{item.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menuId, -1)}
                          className="w-7 h-7 rounded-full bg-airbnb-surface text-airbnb-gray flex items-center justify-center text-sm hover:bg-airbnb-divider"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-6 text-center text-airbnb-black">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menuId, 1)}
                          className="w-7 h-7 rounded-full bg-airbnb-red text-white flex items-center justify-center text-sm hover:bg-airbnb-red-dark"
                        >
                          +
                        </button>
                        <span className="text-sm font-medium w-20 text-right text-airbnb-black">
                          {(item.price * item.quantity).toLocaleString()}원
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.menuId)}
                          className="text-airbnb-error text-xs ml-2 hover:underline"
                        >
                          {t('checkout.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="airbnb-card rounded-airbnb-lg p-12 text-center mb-4">
            <svg
              className="w-16 h-16 text-airbnb-surface mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            <p className="text-airbnb-gray mb-4">{t('checkout.emptyCart')}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 bg-airbnb-red text-white rounded-airbnb-sm font-medium hover:bg-airbnb-red-dark"
            >
              {t('checkout.goToMenu')}
            </button>
          </div>
        )}

        <div className="airbnb-card rounded-airbnb-lg p-5 mb-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-airbnb-gray">{t('checkout.foodAmount')}</span>
              <span className="text-airbnb-black">₩{getSubtotal().toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-airbnb-gray">{t('checkout.deliveryFee')}</span>
              <span className="text-right text-airbnb-black">
                ₩{getDeliveryFeeBreakdown().baseFee.toLocaleString()}
                {getDeliveryFeeBreakdown().extraFee > 0 && (
                  <span className="text-airbnb-gray">
                    {' '}
                    + ₩{getDeliveryFeeBreakdown().extraFee.toLocaleString()}(
                    {t('checkout.additionalFee')})
                  </span>
                )}
              </span>
            </div>
            {deliveryLat && deliveryLng ? (
              <div
                className={`flex justify-between ${getDeliveryFeeBreakdown().surcharge > 0 ? 'text-airbnb-error' : 'text-airbnb-green'}`}
              >
                <span>
                  {t('checkout.distanceSurcharge', {
                    distance: getDeliveryFeeBreakdown().closestRestaurant,
                    km: getDeliveryFeeBreakdown().distance,
                  })}
                </span>
                <span>
                  {getDeliveryFeeBreakdown().surcharge > 0
                    ? `+₩${getDeliveryFeeBreakdown().surcharge.toLocaleString()}`
                    : '₩0'}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-airbnb-gray">
                <span>{t('checkout.distanceSurchargeLabel')}</span>
                <span>{t('checkout.distanceSurchargePlaceholder')}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t border-airbnb-divider pt-2 text-airbnb-black">
              <span>{t('checkout.totalAmount')}</span>
              <span>₩{getTotal().toLocaleString()}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full mb-3 py-3 border border-airbnb-border text-airbnb-black rounded-airbnb-sm font-medium hover:bg-airbnb-surface"
        >
          {t('checkout.continueOrdering')}
        </button>

        <div className="airbnb-card rounded-airbnb-lg p-5 mb-4">
          <h2 className="font-semibold text-airbnb-black mb-3 tracking-airbnb-snug">
            {t('checkout.customerInfo')}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-airbnb-black mb-1">
                {t('checkout.phoneLabel')} <span className="text-airbnb-error">*</span>
              </label>
              <PhoneInput
                value={phone}
                onChange={(e164, display) => setPhone(e164)}
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-airbnb-black mb-1">
                {t('checkout.nameLabel')}
              </label>
              <input
                type="text"
                lang="ko"
                inputMode="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('checkout.namePlaceholder')}
                className="airbnb-input w-full border border-airbnb-border rounded-airbnb-sm px-3 py-2 text-airbnb-black placeholder-airbnb-gray"
              />
            </div>
          </div>
        </div>

        <div className="airbnb-card rounded-airbnb-lg p-5 mb-4">
          <h2 className="font-semibold text-airbnb-black mb-3 tracking-airbnb-snug">
            {t('checkout.deliveryInfo')}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-airbnb-black mb-1">
                {t('checkout.deliveryAddress')} <span className="text-airbnb-error">*</span>
              </label>
              <input
                type="text"
                lang="ko"
                inputMode="text"
                autoComplete="street-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('checkout.addressPlaceholder')}
                required
                className="airbnb-input w-full border border-airbnb-border rounded-airbnb-sm px-3 py-2 text-airbnb-black placeholder-airbnb-gray"
              />
              <button
                type="button"
                onClick={calculateSurcharge}
                disabled={geocoding || !deliveryAddress || deliveryAddress.trim().length < 5}
                className="mt-2 w-full py-2 bg-airbnb-surface border border-airbnb-border text-airbnb-red rounded-airbnb-sm text-sm font-medium hover:bg-airbnb-divider disabled:bg-airbnb-surface disabled:text-airbnb-gray disabled:border-airbnb-border disabled:opacity-40"
              >
                {geocoding
                  ? t('checkout.calculating')
                  : deliveryLat
                    ? t('checkout.recalculate')
                    : t('checkout.calculateDeliveryFee')}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-airbnb-black mb-1">
                {t('checkout.memoLabel')}
              </label>
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                placeholder={t('checkout.memoPlaceholder')}
                rows={2}
                className="airbnb-input w-full border border-airbnb-border rounded-airbnb-sm px-3 py-2 text-airbnb-black placeholder-airbnb-gray"
              />
            </div>
          </div>
        </div>

        {/* 결제 수단 */}
        <div className="airbnb-card rounded-airbnb-lg p-5 mb-4">
          <h2 className="font-semibold text-airbnb-black mb-3 tracking-airbnb-snug">
            {t('checkout.paymentMethod')}
          </h2>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-airbnb-blue-bg border border-airbnb-border rounded-airbnb-sm">
            <svg
              className="w-5 h-5 text-airbnb-blue-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <span className="text-sm font-medium text-airbnb-blue-text">
              {t('checkout.creditCard')}
            </span>
          </div>
        </div>

        {hasAdultItems && (
          <div className="airbnb-card border border-airbnb-error rounded-airbnb-lg p-5 mb-4 bg-white">
            <div className="flex items-start">
              <span className="text-airbnb-error font-bold text-lg mr-2">19+</span>
              <div>
                <p className="text-sm font-medium text-airbnb-error">
                  {t('checkout.adultVerificationTitle')}
                </p>
                <p className="text-xs text-airbnb-error mt-1">
                  {t('checkout.adultVerificationMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handlePayment}
          disabled={submitting || Object.keys(cartData).length === 0 || !sdkLoaded}
          className="w-full bg-airbnb-red text-white py-4 h-14 rounded-airbnb-sm font-semibold hover:bg-airbnb-red-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting
            ? t('checkout.payProcessing')
            : !sdkLoaded
              ? t('checkout.payModuleLoading')
              : t('checkout.payButton', { amount: getTotal().toLocaleString() })}
        </button>
      </main>

      {showPlatformClosedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="relative bg-white rounded-airbnb-lg shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-white border-2 border-airbnb-error rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-airbnb-error"
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
            <h2 className="text-xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">
              {t('checkout.notDeliveryTimeTitle')}
            </h2>
            <p className="text-airbnb-gray mb-4">{t('checkout.notDeliveryTimeMessage')}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-airbnb-black text-white py-3 rounded-airbnb-sm font-medium hover:opacity-80"
            >
              {t('common.goToMain')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}
    >
      <CheckoutContent />
    </Suspense>
  );
}
