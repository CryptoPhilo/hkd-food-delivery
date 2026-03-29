import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!phone) {
      return NextResponse.json(
        { success: false, error: '전화번호가 필요합니다' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ phone });
    if (date) {
      params.append('date', date);
    }
    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/deliveries?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배달 내역 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Driver deliveries error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
