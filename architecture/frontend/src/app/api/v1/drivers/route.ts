import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    let endpoint = '';
    if (action === 'start') {
      endpoint = '/api/v1/drivers/start-duty';
    } else if (action === 'end') {
      endpoint = '/api/v1/drivers/end-duty';
    } else {
      return NextResponse.json(
        { success: false, error: '잘못된 action입니다' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '작업 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Driver action error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

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

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/status/${encodeURIComponent(phone)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '상태 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Driver status error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
