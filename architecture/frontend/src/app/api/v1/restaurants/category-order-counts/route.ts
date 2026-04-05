import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('regionId');

    const params = new URLSearchParams();
    if (regionId) params.set('regionId', regionId);

    const response = await fetch(`${BACKEND_URL}/api/v1/restaurants/category-order-counts?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Category order counts error:', error);
    return NextResponse.json({ success: false, data: {} });
  }
}
