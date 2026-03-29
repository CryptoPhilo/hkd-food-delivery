import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(
  request: Request,
  { params }: { params: { restaurantId: string } }
) {
  try {
    const { restaurantId } = params;

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/restaurants/${restaurantId}/menus`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '메뉴 목록 조회 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Menus fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '메뉴 목록 조회 중 오류 발생' },
      { status: 500 }
    );
  }
}
