import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('*, menus(*)')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: restaurant });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}