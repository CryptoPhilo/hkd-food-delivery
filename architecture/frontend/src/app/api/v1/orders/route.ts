import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { phone, name, restaurantId, items, deliveryAddress, deliveryLat, deliveryLng, customerMemo } = body;

    let userId = null;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ phone, name: name || null })
        .select()
        .single();
      userId = newUser?.id;
    }

    if (!userId) throw new Error('Failed to create/get user');

    const { data: menus } = await supabase
      .from('menus')
      .select('id, price')
      .in('id', items.map((i: any) => i.menuId));

    let totalAmount = 0;
    for (const item of items) {
      const menu = menus?.find(m => m.id === item.menuId);
      if (menu) totalAmount += menu.price * item.quantity;
    }

    const orderNumber = generateOrderNumber();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: userId,
        restaurant_id: restaurantId,
        delivery_address: deliveryAddress || '',
        delivery_latitude: deliveryLat || 0,
        delivery_longitude: deliveryLng || 0,
        customer_memo: customerMemo || null,
        subtotal: totalAmount,
        delivery_fee: 0,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    for (const item of items) {
      const menu = menus?.find(m => m.id === item.menuId);
      await supabase.from('order_items').insert({
        order_id: order.id,
        menu_id: item.menuId,
        quantity: item.quantity,
        price: menu?.price || 0,
      });
    }

    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, restaurant(*), items(*, menu(*)), user(*)')
      .eq('id', order.id)
      .single();

    return NextResponse.json({ success: true, data: fullOrder }, { status: 201 });
  } catch (error) {
    console.error('Order error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (!user) {
      return NextResponse.json({ success: true, data: [] });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('*, restaurant(*), items(*, menu(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ success: true, data: orders || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}