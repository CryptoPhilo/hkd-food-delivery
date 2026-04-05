import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isOnDuty = searchParams.get('isOnDuty');

    const params = new URLSearchParams();
    if (isOnDuty !== null) {
      params.append('isOnDuty', isOnDuty);
    }

    // [SECURITY] 어드민 사용자의 regionId를 배달원 목록 필터에 추가
    const adminUserHeader = request.headers.get('x-admin-user');
    if (adminUserHeader) {
      try {
        // X-Admin-User 헤더는 Base64 인코딩되어 전송됨
        const decoded = decodeURIComponent(escape(atob(adminUserHeader)));
        const admin = JSON.parse(decoded);
        if (admin.role === 'region_admin' && admin.regionId) {
          params.append('regionId', admin.regionId);
        }
      } catch (e) {
        console.error('Admin user header decode error:', e);
      }
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/list?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배달원 목록 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Admin drivers error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/drivers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '배달원 등록 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Driver register error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
