import { NextResponse } from 'next/server';
import { BACKEND_URL, getAdminHeaders } from '../../proxy-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/admin/orders/available-drivers`, {
      method: 'GET',
      headers: getAdminHeaders(request),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
