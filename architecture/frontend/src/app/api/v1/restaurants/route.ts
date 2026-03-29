import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDeliveryFee(distance: number): { fee: number; isDeliverable: boolean } {
  if (distance > 5.0) return { fee: 0, isDeliverable: false };
  if (distance > 4.0) return { fee: 6000, isDeliverable: true };
  if (distance > 3.0) return { fee: 5000, isDeliverable: true };
  if (distance > 2.0) return { fee: 4000, isDeliverable: true };
  if (distance > 1.0) return { fee: 3000, isDeliverable: true };
  return { fee: 2000, isDeliverable: true };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const response = await fetch(`${BACKEND_URL}/api/v1/restaurants`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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
        const { fee, isDeliverable } = calculateDeliveryFee(distance);
        return {
          ...r,
          distance,
          deliveryFee: fee,
          isDeliverable,
          estimatedDeliveryTime: Math.ceil(20 + (distance / 30) * 60),
        };
      });
    }

    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      data: paginated,
      pagination: {
        page,
        limit,
        total: result.length,
        totalPages: Math.ceil(result.length / limit),
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}