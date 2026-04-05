import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.hankyeong.xyz';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/settings/platform-hours`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const text = await response.text();
    console.log('[platform-hours GET] backend response:', response.status, text.slice(0, 300));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // 백엔드 응답 파싱 실패 시 기본값 반환
      console.error('[platform-hours GET] JSON parse failed, using defaults');
      return NextResponse.json({
        success: true,
        data: { openTime: '09:00', closeTime: '22:00', isActive: true, closedDays: [] },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[platform-hours GET] Error:', error);
    // 백엔드 연결 실패 시에도 기본값 반환 (운영 중)
    return NextResponse.json({
      success: true,
      data: { openTime: '09:00', closeTime: '22:00', isActive: true, closedDays: [] },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[platform-hours POST] body:', JSON.stringify(body));

    const response = await fetch(`${BACKEND_URL}/api/v1/settings/platform-hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    console.log('[platform-hours POST] backend response:', response.status, text.slice(0, 300));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: `백엔드 응답 파싱 실패 (${response.status}): ${text.slice(0, 200)}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[platform-hours POST] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
