import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { area, maxResults = 20 } = body;

    if (!area) {
      return NextResponse.json(
        { success: false, error: '지역명을 입력해주세요' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ area, maxResults }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '스크래핑 실패');
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Scrape proxy error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '스크래핑 중 오류 발생' },
      { status: 500 }
    );
  }
}
