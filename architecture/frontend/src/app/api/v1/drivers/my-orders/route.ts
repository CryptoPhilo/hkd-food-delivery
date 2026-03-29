import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '전화번호가 필요합니다' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ phone });

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/my-orders?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배정 주문 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('My orders error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
