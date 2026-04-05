import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    // 클라이언트의 쿠키를 백엔드로 전달
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    });

    const data = await response.json();

    // 백엔드 응답의 Set-Cookie(새 Refresh Token)를 클라이언트에 전달
    const nextRes = NextResponse.json(data, { status: response.status });
    const setCookie = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookie) {
      nextRes.headers.append('Set-Cookie', cookie);
    }

    return nextRes;
  } catch (error: any) {
    console.error('[Auth Refresh] 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
