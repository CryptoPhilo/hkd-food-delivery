'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface ConfirmResponse {
  success: boolean;
  message?: string;
  data?: {
    orderId: string;
    orderNumber: string;
    status: string;
    estimatedDeliveryTime: number;
  };
  error?: string;
}

export default function ConfirmPage() {
  const t = useTranslations();
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ConfirmResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    const confirmOrder = async () => {
      try {
        const response = await fetch(`/api/v1/orders/confirm/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        setResult(data);
      } catch (error) {
        setResult({
          success: false,
          error: t('confirm.processingError'),
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      confirmOrder();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red mx-auto mb-4"></div>
          <p className="text-airbnb-gray">{t('confirm.loading')}</p>
        </div>
      </div>
    );
  }

  if (!result?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="max-w-md w-full mx-4 airbnb-card p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-airbnb-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('confirm.failTitle')}</h1>
          <p className="text-airbnb-gray mb-6">{result?.error || t('confirm.invalidAccess')}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-airbnb-black text-white py-3 px-4 rounded-airbnb-sm font-medium hover:bg-airbnb-red transition-colors"
          >
            {t('confirm.goToMain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full mx-4 airbnb-card p-8 text-center">
        <div className="w-16 h-16 bg-airbnb-green-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-airbnb-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('confirm.successTitle')}</h1>
        <p className="text-airbnb-gray mb-4">{t('confirm.orderNumber')} {result.data?.orderNumber}</p>

        <div className="bg-airbnb-surface rounded-airbnb-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-airbnb-gray">{t('confirm.estimatedDelivery')}</span>
            <span className="font-semibold text-airbnb-black">
              {t('orderDetail.aboutMinutes', { minutes: result.data?.estimatedDeliveryTime ?? 0 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-airbnb-gray">{t('confirm.orderStatus')}</span>
            <span className="font-semibold text-airbnb-green">
              {result.data?.status === 'order_confirmed' ? t('confirm.confirmed') : result.data?.status}
            </span>
          </div>
        </div>

        <button
          onClick={() => router.push(`/order/${result.data?.orderId}`)}
          className="w-full bg-airbnb-red text-white py-3 px-4 rounded-airbnb-sm font-medium hover:bg-airbnb-red-dark transition-colors"
        >
          {t('confirm.viewOrderStatus')}
        </button>
      </div>
    </div>
  );
}
