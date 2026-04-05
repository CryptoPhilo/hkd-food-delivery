'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { fetchWithAuth } from '@/utils/auth';

function CompleteContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const paymentId = searchParams.get('paymentId');
    const code = searchParams.get('code');
    const errorMessage = searchParams.get('message');

    // 사용자 취소 또는 에러
    if (code) {
      setStatus('fail');
      setMessage(code === 'USER_CANCEL' ? t('checkoutComplete.paymentCancelled') : (errorMessage || t('checkoutComplete.paymentFailedGeneric')));
      return;
    }

    if (!paymentId) {
      setStatus('fail');
      setMessage(t('checkoutComplete.paymentInfoNotFound'));
      return;
    }

    // 결제 성공 → 서버 검증 + 주문 생성
    processPayment(paymentId);
  }, [searchParams]);

  const processPayment = async (paymentId: string) => {
    try {
      // localStorage에서 장바구니 데이터 읽기
      const savedCart = localStorage.getItem('cart');
      if (!savedCart) {
        setStatus('fail');
        setMessage(t('checkoutComplete.cartNotFound'));
        return;
      }
      const cartData = JSON.parse(savedCart);

      // localStorage (우선) 또는 sessionStorage에서 고객 정보 읽기 (모바일 리다이렉트 시 sessionStorage 손실 대비)
      const savedInfo = localStorage.getItem('hkd_checkout_info') || sessionStorage.getItem('hkd_checkout_info');
      const info = savedInfo ? JSON.parse(savedInfo) : {};

      // localStorage (우선) 또는 sessionStorage에서 결제 정보 읽기
      const savedPayment = localStorage.getItem('hkd_payment_info') || sessionStorage.getItem('hkd_payment_info');
      const paymentInfo = savedPayment ? JSON.parse(savedPayment) : null;
      const totalAmount = paymentInfo?.totalAmount || 0;
      const deliveryLat = paymentInfo?.deliveryLat || 33.3615;
      const deliveryLng = paymentInfo?.deliveryLng || 126.3098;

      if (!totalAmount) {
        setStatus('fail');
        setMessage(t('checkoutComplete.amountNotFound'));
        return;
      }

      // 1. 서버에서 결제 검증
      const verifyResponse = await fetch('/api/v1/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, amount: Math.floor(totalAmount) }),
      });
      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        setStatus('fail');
        setMessage(t('checkoutComplete.verifyFailed', { error: verifyData.error || '' }));
        return;
      }

      // 2. 고객 정보 확인
      if (!info.phone) {
        setStatus('fail');
        setMessage(t('checkoutComplete.phoneNotFound'));
        return;
      }

      // 3. 각 식당별 주문 생성
      const restaurantIds = Object.keys(cartData);
      let firstOrderId = '';
      const orderErrors: string[] = [];
      const savedDeliveryFee = paymentInfo?.deliveryFee || 5000;

      // 복수 식당 주문인 경우 deliveryGroupId 생성
      const deliveryGroupId = restaurantIds.length > 1 ? crypto.randomUUID() : undefined;

      for (let i = 0; i < restaurantIds.length; i++) {
        const rid = restaurantIds[i];
        const orderDeliveryFee = i === 0 ? savedDeliveryFee : 0;
        const orderData = {
          phone: info.phone.replace(/-/g, ''),
          name: info.name || null,
          restaurantId: rid,
          items: cartData[rid].items.map((item: any) => ({
            menuId: item.menuId,
            quantity: item.quantity,
          })),
          deliveryAddress: info.deliveryAddress || '제주특별자치도 한경면',
          deliveryLat,
          deliveryLng,
          customerMemo: info.customerMemo || null,
          impUid: paymentId,
          deliveryFee: orderDeliveryFee,
          locale,
          deliveryGroupId,
        };

        console.log('[Order] 주문 생성 요청:', JSON.stringify(orderData));

        const response = await fetchWithAuth('/api/v1/orders', {
          method: 'POST',
          body: JSON.stringify(orderData),
        });
        const data = await response.json();

        console.log('[Order] 주문 생성 응답:', JSON.stringify(data));

        if (!data.success) {
          // 주문 생성 실패 → 결제 자동 취소
          const details = data.details ? ` [${Array.isArray(data.details) ? data.details.join(', ') : data.details}]` : '';
          const errorMsg = (data.error || t('checkoutComplete.orderCreationError')) + details;
          try {
            await fetch('/api/v1/payments/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, amount: Math.floor(totalAmount), reason: errorMsg }),
            });
          } catch (cancelErr) {
            console.error('결제 취소 요청 오류:', cancelErr);
          }
          setStatus('fail');
          setMessage(t('checkoutComplete.orderCreationFailed', { reason: errorMsg }));
          return;
        }

        if (!firstOrderId) {
          firstOrderId = data.data.id;
        }
      }

      if (!firstOrderId) {
        setStatus('fail');
        setMessage(t('checkoutComplete.orderCreationError'));
        return;
      }

      // 장바구니 비우기 + 전화번호 저장
      localStorage.removeItem('cart');
      if (info.phone) {
        localStorage.setItem('hkd_phone', info.phone.replace(/-/g, ''));
      }
      localStorage.removeItem('hkd_checkout_info');
      localStorage.removeItem('hkd_payment_info');
      sessionStorage.removeItem('hkd_checkout_info');
      sessionStorage.removeItem('hkd_payment_info');

      setStatus('success');
      setMessage(t('checkoutComplete.paymentAndOrderComplete'));

      // 2초 후 주문 상세 페이지로 이동
      setTimeout(() => {
        if (firstOrderId) {
          router.push(`/order/${firstOrderId}`);
        } else {
          router.push('/');
        }
      }, 2000);

    } catch (error: any) {
      setStatus('fail');
      setMessage(t('checkoutComplete.orderProcessingError', { error: error.message || '' }));
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="airbnb-card max-w-sm w-full p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red mx-auto mb-4"></div>
            <p className="text-airbnb-gray">{t('checkoutComplete.verifying')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-airbnb-green-bg rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-airbnb-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('checkoutComplete.orderComplete')}</h2>
            <p className="text-airbnb-gray mb-3">{message}</p>
            <p className="text-sm text-airbnb-gray">{t('checkoutComplete.trackInMyOrders') || '\'내 주문 조회\'에서 배달 상태를 실시간으로 확인할 수 있습니다.'}</p>
          </>
        )}
        {status === 'fail' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-airbnb-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('checkoutComplete.paymentFailed')}</h2>
            <p className="text-airbnb-gray mb-4">{message}</p>
            <button
              onClick={() => router.push('/checkout')}
              className="w-full bg-airbnb-black text-white py-3 rounded-airbnb-sm font-medium hover:bg-airbnb-red transition-colors"
            >
              {t('common.retry')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red"></div>
      </div>
    }>
      <CompleteContent />
    </Suspense>
  );
}
