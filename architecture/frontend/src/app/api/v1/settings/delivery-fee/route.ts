import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: setting } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'delivery_fee')
      .single();

    const defaultFee = {
      baseFee: 5000,
      extraPerRestaurant: 3000,
    };

    if (setting) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(setting.value),
      });
    }

    return NextResponse.json({ success: true, data: defaultFee });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { data: setting, error } = await supabase
      .from('settings')
      .upsert({
        key: 'delivery_fee',
        value: JSON.stringify(body),
        type: 'delivery_fee',
      }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: setting });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}