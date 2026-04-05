'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

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
  deliveryLatitude: number;
  deliveryLongitude: number;
  estimatedPickupTime: string | null;
  estimatedDeliveryTime: number | null;
  customerMemo: string | null;
  restaurantMemo: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  customerPaidAt: string | null;
  restaurantPaidAmount: number | null;
  restaurantPaidAt: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  driverId: string | null;
  createdAt: string;
  updatedAt: string;
  user: { phone: string; name: string | null };
  restaurant: { name: string; phone: string | null; address: string };
  items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: '신규 주문',
  confirmed: '배달원 배정됨',
  picking_up: '픽업 중',
  delivering: '배달 중',
  delivered: '배달 완료',
  cancelled: '취소됨',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  picking_up: 'bg-purple-100 text-purple-800',
  delivering: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const { adminFetch } = useAdminAuth();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      // 전체 주문 목록에서 해당 주문 찾기
      const res = await adminFetch('/api/v1/admin/orders?status=all');
      const data = await res.json();
      if (data.success) {
        const found = data.data.find((o: Order) => o.id === orderId);
        if (found) {
          setOrder(found);
        } else {
          setError('주문을 찾을 수 없습니다');
        }
      } else {
        setError(data.error || '주문 조회 실패');
      }
    } catch {
      setError('주문 조회 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500 mb-4">{error || '주문을 찾을 수 없습니다'}</p>
        <button onClick={() => router.push('/admin/orders')} className="text-blue-600 hover:underline">
          주문 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
            ← 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
          <span className={`px-3 py-1 text-sm rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>
        <button
          onClick={() => router.push(`/admin/orders?status=${order.status}`)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
        >
          같은 상태 주문 보기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium text-lg mb-4 border-b pb-2">주문 정보</h3>
          <div className="space-y-3 text-sm">
            <Row label="주문번호" value={order.orderNumber} />
            <Row label="상태" value={STATUS_LABELS[order.status] || order.status} />
            <Row label="결제 방법" value={order.paymentMethod || '-'} />
            <Row label="결제 상태" value={order.paymentStatus} />
            <Row label="주문 시간" value={formatDateTime(order.createdAt)} />
            <Row label="최종 수정" value={formatDateTime(order.updatedAt)} />
          </div>
        </div>

        {/* 고객 정보 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium text-lg mb-4 border-b pb-2">고객 / 배달 정보</h3>
          <div className="space-y-3 text-sm">
            <Row label="고객명" value={order.user.name || '-'} />
            <Row label="전화번호" value={order.user.phone} />
            <Row label="배달 주소" value={order.deliveryAddress} />
            <Row label="배달원 ID" value={order.driverId || '미배정'} />
            {order.customerMemo && <Row label="고객 메모" value={order.customerMemo} />}
            {order.restaurantMemo && <Row label="식당 메모" value={order.restaurantMemo} />}
          </div>
        </div>

        {/* 식당 정보 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium text-lg mb-4 border-b pb-2">식당 정보</h3>
          <div className="space-y-3 text-sm">
            <Row label="식당명" value={order.restaurant.name} />
            <Row label="전화번호" value={order.restaurant.phone || '-'} />
            <Row label="주소" value={order.restaurant.address} />
          </div>
        </div>

        {/* 처리 타임라인 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="font-medium text-lg mb-4 border-b pb-2">처리 타임라인</h3>
          <div className="space-y-3 text-sm">
            <Row label="주문 접수" value={formatDateTime(order.createdAt)} />
            <Row label="배달원 배정" value={formatDateTime(order.confirmedAt)} />
            <Row label="픽업 예정" value={formatDateTime(order.estimatedPickupTime)} />
            <Row label="픽업 완료" value={formatDateTime(order.pickedUpAt)} />
            <Row label="배달 완료" value={formatDateTime(order.deliveredAt)} />
            {order.cancelledAt && (
              <>
                <Row label="취소 시간" value={formatDateTime(order.cancelledAt)} highlight="red" />
                <Row label="취소 사유" value={order.cancelReason || '-'} highlight="red" />
              </>
            )}
          </div>
        </div>

        {/* 주문 메뉴 */}
        <div className="bg-white rounded-lg shadow p-5 lg:col-span-2">
          <h3 className="font-medium text-lg mb-4 border-b pb-2">주문 메뉴</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">메뉴</th>
                <th className="pb-2 text-center">수량</th>
                <th className="pb-2 text-right">단가</th>
                <th className="pb-2 text-right">소계</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2">{item.menuName}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{item.unitPrice.toLocaleString()}원</td>
                  <td className="py-2 text-right">{item.subtotal.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="pt-3 text-right text-gray-500">음식 금액</td>
                <td className="pt-3 text-right">{order.subtotal.toLocaleString()}원</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-1 text-right text-gray-500">배달비</td>
                <td className="py-1 text-right">{order.deliveryFee.toLocaleString()}원</td>
              </tr>
              <tr className="font-medium text-base">
                <td colSpan={3} className="pt-1 text-right">총액</td>
                <td className="pt-1 text-right">{order.totalAmount.toLocaleString()}원</td>
              </tr>
              {order.restaurantPaidAmount != null && (
                <tr className="text-gray-500">
                  <td colSpan={3} className="pt-1 text-right">식당 결제 금액</td>
                  <td className="pt-1 text-right">{order.restaurantPaidAmount.toLocaleString()}원</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const valueColor = highlight === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right max-w-[60%] ${valueColor}`}>{value}</span>
    </div>
  );
}
