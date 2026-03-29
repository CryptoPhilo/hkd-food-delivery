import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/admin/restaurants`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '식당 목록 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Restaurants proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '식당 목록 조회 중 오류 발생' },
      { status: 500 }
    );
  }
}
