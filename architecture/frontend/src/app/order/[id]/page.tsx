'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface OrderItem {
  id: string;
  menuName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryAddress: string;
  estimatedPickupTime: string | null;
  estimatedDeliveryTime: number | null;
  customerMemo: string | null;
  restaurantMemo: string | null;
  createdAt: string;
  user: {
    phone: string;
    name: string | null;
  };
  restaurant: {
    name: string;
    phone: string | null;
  };
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: '주문 요청됨',
  pending_confirmation: '확인 대기중',
  order_confirmed: '주문 확정',
  picked_up: '픽업 완료',
  delivering: '배달 중',
  completed: '배달 완료',
  cancelled: '주문 취소',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_confirmation: 'bg-blue-100 text-blue-800',
  order_confirmed: 'bg-green-100 text-green-800',
  picked_up: 'bg-purple-100 text-purple-800',
  delivering: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}`);
      const data = await response.json();
      if (data.success) {
        setOrder(data.data);
      } else {
        setError(data.error || '주문을 찾을 수 없습니다.');
      }
    } catch (err) {
      setError('주문 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '주문을 찾을 수 없습니다.'}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            메인으로
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">주문 현황</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500">주문번호</p>
              <p className="text-lg font-bold text-gray-900">{order.orderNumber}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[order.status]}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">식당</p>
            <p className="font-medium">{order.restaurant.name}</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">배달 주소</p>
            <p className="font-medium">{order.deliveryAddress}</p>
          </div>

          {order.estimatedDeliveryTime && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-1">예상 배달 시간</p>
              <p className="font-medium text-blue-600">약 {order.estimatedDeliveryTime}분</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">주문 메뉴</h2>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.menuName} x{item.quantity}
                </span>
                <span className="text-gray-600">{item.subtotal.toLocaleString()}원</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">菜品金额</span>
              <span>{order.subtotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">배달비</span>
              <span>{order.deliveryFee.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>총액</span>
              <span>{order.totalAmount.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {order.customerMemo && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-2">고객 메모</h2>
            <p className="text-sm text-gray-600">{order.customerMemo}</p>
          </div>
        )}

        {order.restaurantMemo && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-2">식당 메모</h2>
            <p className="text-sm text-gray-600">{order.restaurantMemo}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">주문 시간</p>
          <p className="text-sm">{formatDate(order.createdAt)}</p>
        </div>

        <Link
          href="/"
          className="block w-full text-center bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200"
        >
          다른 식당 보기
        </Link>
      </main>
    </div>
  );
}
