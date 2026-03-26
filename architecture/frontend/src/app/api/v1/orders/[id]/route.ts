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

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, restaurant(*), items(*, menu(*)), user(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}