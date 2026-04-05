import { NextResponse } from 'next/server';
import { BACKEND_URL, getAdminHeaders } from '../../proxy-helpers';

export const dynamic = 'force-dynamic';

// PUT /api/v1/admin/orders/:orderId - advance or cancel
export async function PUT(request: Request, context: any) {
  try {
    const orderId = context.params.orderId;
    const body = await request.json();
    const { action, ...data } = body;

    let endpoint: string;
    if (action === 'cancel') {
      endpoint = `${BACKEND_URL}/api/v1/admin/orders/${orderId}/cancel`;
    } else {
      endpoint = `${BACKEND_URL}/api/v1/admin/orders/${orderId}/advance`;
    }

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: getAdminHeaders(request),
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/v1/admin/orders/:orderId
export async function DELETE(request: Request, context: any) {
  try {
    const orderId = context.params.orderId;
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/orders/${orderId}`, {
      method: 'DELETE',
      headers: getAdminHeaders(request),
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
