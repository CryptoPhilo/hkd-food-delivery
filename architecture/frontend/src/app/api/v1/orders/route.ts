import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      throw new Error(errorMsg);
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Order error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const date = searchParams.get('date');

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 });
    }

    const params = new URLSearchParams({ phone });
    if (date) {
      params.append('date', date);
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/orders?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '주문 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}