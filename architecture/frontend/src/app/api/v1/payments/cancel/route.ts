import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log('[Payments/Cancel] 요청:', JSON.stringify(body).slice(0, 300));

    const response = await fetch(`${BACKEND_URL}/api/v1/payments/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    console.log('[Payments/Cancel] 백엔드 응답:', response.status, text.slice(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: `결제 취소 응답 파싱 실패 (${response.status}): ${text.slice(0, 200)}` },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Payments/Cancel] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Payment cancellation failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
