import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const response = await fetch(`${BACKEND_URL}/api/v1/restaurants/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '식당 정보 조회 실패');
    }

    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}