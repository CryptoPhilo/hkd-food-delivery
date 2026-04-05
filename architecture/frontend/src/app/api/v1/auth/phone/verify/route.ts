import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/auth/phone/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // 백엔드 응답의 Set-Cookie 헤더를 클라이언트에 전달 (httpOnly Refresh Token)
    const nextRes = NextResponse.json(data, { status: response.status });
    const setCookie = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookie) {
      nextRes.headers.append('Set-Cookie', cookie);
    }

    return nextRes;
  } catch (error: any) {
    console.error('[Auth Phone Verify] 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
