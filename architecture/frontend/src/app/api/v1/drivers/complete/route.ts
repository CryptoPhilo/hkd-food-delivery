import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: '주문 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/complete/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배달 완료 처리 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Complete delivery error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
