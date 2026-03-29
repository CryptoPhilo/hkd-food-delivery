import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function PUT(
  request: Request,
  { params }: { params: { menuId: string } }
) {
  try {
    const { menuId } = params;
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/menus/${menuId}/image`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '메뉴 이미지 업데이트 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Menu image update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '메뉴 이미지 업데이트 중 오류 발생' },
      { status: 500 }
    );
  }
}
