import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.hankyeong.xyz';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/settings/delivery-fee`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        success: true,
        data: { baseFee: 3000, perKmFee: 500, maxDistance: 5.0, freeDeliveryThreshold: 30000 },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[delivery-fee GET] Error:', error);
    return NextResponse.json({
      success: true,
      data: { baseFee: 3000, perKmFee: 500, maxDistance: 5.0, freeDeliveryThreshold: 30000 },
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/settings/delivery-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: `백엔드 응답 파싱 실패 (${response.status})` },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[delivery-fee POST] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
