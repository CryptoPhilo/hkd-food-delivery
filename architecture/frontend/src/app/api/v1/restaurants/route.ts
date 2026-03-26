import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

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
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('*, menus(*)')
      .eq('is_active', true);

    if (error) throw error;

    let result = (restaurants || []).map((r: any) => ({
      ...r,
      isActive: r.is_active,
      isDeliverable: r.is_deliverable,
      businessHours: r.business_hours,
      businessStatus: r.business_status,
      roadAddress: r.road_address,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
    
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      
      result = (restaurants || []).map((r: any) => {
        const distance = calculateDistance(userLat, userLng, r.latitude, r.longitude);
        const { fee, isDeliverable } = calculateDeliveryFee(distance);
        return {
          ...r,
          isActive: r.is_active,
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