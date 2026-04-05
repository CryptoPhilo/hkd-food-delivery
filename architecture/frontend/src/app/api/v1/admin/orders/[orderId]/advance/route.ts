import { NextResponse } from 'next/server';
import { BACKEND_URL, getAdminHeaders } from '../../../proxy-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/v1/admin/orders/:orderId/advance
export async function PUT(request: Request, context: any) {
  try {
    const orderId = context.params.orderId;
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/orders/${orderId}/advance`, {
      method: 'PUT',
      headers: getAdminHeaders(request),
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
