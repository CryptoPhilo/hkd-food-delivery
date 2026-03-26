'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

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
          error: '주문 취소 처리 중 오류가 발생했습니다.',
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">주문을 취소하고 환불을 처리하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (!result?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">주문 취소 실패</h1>
          <p className="text-gray-600 mb-6">{result?.error || '잘못된 접근입니다.'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            메인으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">주문이 취소되었습니다</h1>
        <p className="text-gray-600 mb-4">주문번호: {result.data?.orderNumber}</p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">환불 금액</span>
            <span className="font-semibold text-gray-900">
              {result.data?.refundedAmount?.toLocaleString()}원
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">환불 상태</span>
            <span className="font-semibold text-orange-600">
              처리중 (3~5일 소요)
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          환불은 카드사에 따라 3~5영업일 이내에 처리됩니다.
        </p>

        <button
          onClick={() => router.push('/')}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          메인으로 이동
        </button>
      </div>
    </div>
  );
}
