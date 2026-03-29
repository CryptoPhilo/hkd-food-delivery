import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, orderIds, phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '전화번호가 필요합니다' },
        { status: 400 }
      );
    }

    let endpoint = '';
    let requestBody: any = { phone };

    if (orderId) {
      endpoint = `/api/v1/drivers/assign/${orderId}`;
    } else if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      endpoint = '/api/v1/drivers/assign-batch';
      requestBody.orderIds = orderIds;
    } else {
      return NextResponse.json(
        { success: false, error: '주문 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배달 할당 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Assign order error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
