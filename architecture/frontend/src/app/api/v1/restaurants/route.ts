import { NextResponse } from 'next/server';
import { calculateDistance, calculateDeliveryFee, isWithinDeliveryRange } from '@/utils/distance';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const regionId = searchParams.get('regionId');
    const limit = searchParams.get('limit') || '20';

    // regionId가 있으면 백엔드에 전달
    const backendParams = new URLSearchParams();
    if (regionId) backendParams.set('regionId', regionId);
    if (limit) backendParams.set('limit', limit);

    const response = await fetch(`${BACKEND_URL}/api/v1/restaurants?${backendParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '식당 목록 조회 실패');
    }

    let result = data.data || [];

    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      result = result.map((r: any) => {
        const distance = calculateDistance(userLat, userLng, r.latitude, r.longitude);
        const deliverable = isWithinDeliveryRange(distance, r.deliveryRadius);
        const { fee } = calculateDeliveryFee(distance);
        return {
          ...r,
          distance,
          deliveryFee: deliverable ? fee : 0,
          isDeliverable: r.isDeliverable && deliverable,
          estimatedDeliveryTime: Math.ceil(20 + (distance / 30) * 60),
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      pagination: data.pagination,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
