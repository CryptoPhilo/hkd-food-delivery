import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: setting } = await supabase
      .from('settings')
      .select('*')
      .eq('key', 'platform_hours')
      .single();

    const defaultSettings = {
      openTime: '09:00',
      closeTime: '22:00',
      isActive: true,
    };

    if (setting) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(setting.value),
      });
    }

    return NextResponse.json({ success: true, data: defaultSettings });
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
        key: 'platform_hours',
        value: JSON.stringify(body),
        type: 'platform_hours',
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
