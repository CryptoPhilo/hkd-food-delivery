'use client';

import { useState, useEffect } from 'react';

interface OrderStats {
  pending: number;
  pending_confirmation: number;
  order_confirmed: number;
  picked_up: number;
  delivering: number;
  completed: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  restaurantName: string;
  totalAmount: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<OrderStats>({
    pending: 0,
    pending_confirmation: 0,
    order_confirmed: 0,
    picked_up: 0,
    delivering: 0,
    completed: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/v1/admin/dashboard');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setRecentOrders(data.recentOrders);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '신규 주문' },
      pending_confirmation: { bg: 'bg-blue-100', text: 'text-blue-800', label: '확인 대기' },
      order_confirmed: { bg: 'bg-green-100', text: 'text-green-800', label: '확정' },
      picked_up: { bg: 'bg-purple-100', text: 'text-purple-800', label: '픽업 완료' },
      delivering: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: '배달 중' },
      completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: '완료' },
    };
    const { bg, text, label } = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="신규 주문"
          count={stats.pending}
          color="yellow"
          href="/admin/orders?status=pending"
        />
        <StatCard
          label="확인 대기"
          count={stats.pending_confirmation}
          color="blue"
          href="/admin/orders?status=pending_confirmation"
        />
        <StatCard
          label="확정"
          count={stats.order_confirmed}
          color="green"
          href="/admin/orders?status=order_confirmed"
        />
        <StatCard
          label="픽업 완료"
          count={stats.picked_up}
          color="purple"
          href="/admin/orders?status=picked_up"
        />
        <StatCard
          label="배달 중"
          count={stats.delivering}
          color="indigo"
          href="/admin/orders?status=delivering"
        />
        <StatCard
          label="완료"
          count={stats.completed}
          color="gray"
          href="/admin/orders?status=completed"
        />
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            최근 주문
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  식당
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시간
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    주문 내역이 없습니다
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.restaurantName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.totalAmount.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(order.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <a
                        href={`/admin/orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        보기
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  count, 
  color, 
  href 
}: { 
  label: string; 
  count: number; 
  color: string;
  href: string;
}) {
  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  return (
    <a
      href={href}
      className={`relative overflow-hidden rounded-lg border p-4 ${colorMap[color]} hover:opacity-90 transition-opacity`}
    >
      <dt>
        <p className="text-sm font-medium truncate">{label}</p>
      </dt>
      <dd className="mt-1">
        <p className="text-3xl font-semibold">{count}</p>
      </dd>
    </a>
  );
}
