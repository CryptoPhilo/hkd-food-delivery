import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log('[Orders API] POST 요청 → backend:', JSON.stringify(body).slice(0, 500));

    const response = await fetch(`${BACKEND_URL}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    console.log('[Orders API] 백엔드 응답:', response.status, text.slice(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: `백엔드 응답 파싱 실패 (${response.status}): ${text.slice(0, 200)}` },
        { status: 500 }
      );
    }

    if (!response.ok) {
      const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      return NextResponse.json({ success: false, error: errorMsg, details: data.details }, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('[Orders API] 오류:', error);
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