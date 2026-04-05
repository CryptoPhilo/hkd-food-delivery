'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CancelResponse {
  success: boolean;
  message?: string;
  data?: {
    orderId: string;
    orderNumber: string;
    status: string;
    refundedAmount: number;
  };
  error?: string;
}

export default function CancelPage() {
  const t = useTranslations();
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CancelResponse | null>(null);
  const router = useRouter();

  useEffect(() => {
    const cancelOrder = async () => {
      try {
        const response = await fetch(`/api/v1/orders/cancel/${token}`, {
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
          error: t('cancel.processingError'),
        });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      cancelOrder();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-airbnb-red mx-auto mb-4"></div>
          <p className="text-airbnb-gray">{t('cancel.loading')}</p>
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
          <h1 className="text-2xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('cancel.failTitle')}</h1>
          <p className="text-airbnb-gray mb-6">{result?.error || t('cancel.invalidAccess')}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-airbnb-black text-white py-3 px-4 rounded-airbnb-sm font-medium hover:bg-airbnb-red transition-colors"
          >
            {t('cancel.goToMain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full mx-4 airbnb-card p-8 text-center">
        <div className="w-16 h-16 bg-airbnb-yellow-bg rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-airbnb-yellow-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-airbnb-black mb-2 tracking-airbnb-tight">{t('cancel.successTitle')}</h1>
        <p className="text-airbnb-gray mb-4">{t('cancel.orderNumber')} {result.data?.orderNumber}</p>

        <div className="bg-airbnb-surface rounded-airbnb-sm p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-airbnb-gray">{t('cancel.refundAmount')}</span>
            <span className="font-semibold text-airbnb-black">
              ₩{result.data?.refundedAmount?.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-airbnb-gray">{t('cancel.refundStatus')}</span>
            <span className="font-semibold text-airbnb-yellow-text">
              {t('cancel.refundProcessing')}
            </span>
          </div>
        </div>

        <p className="text-sm text-airbnb-gray mb-6">
          {t('cancel.refundNotice')}
        </p>

        <button
          onClick={() => router.push('/')}
          className="w-full bg-airbnb-black text-white py-3 px-4 rounded-airbnb-sm font-medium hover:bg-airbnb-red transition-colors"
        >
          {t('cancel.goToMain')}
        </button>
      </div>
    </div>
  );
}
