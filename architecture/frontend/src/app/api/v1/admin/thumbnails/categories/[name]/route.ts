import { NextResponse } from 'next/server';
import { BACKEND_URL, getAdminHeaders } from '../../../proxy-helpers';

export const dynamic = 'force-dynamic';

// [SECURITY] M-3: X-Admin-Key 제거 → httpOnly 쿠키 기반 인증으로 전환
export async function PUT(request: Request, { params }: { params: { name: string } }) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/api/v1/admin/thumbnails/categories/${encodeURIComponent(params.name)}`,
      {
        method: 'PUT',
        headers: getAdminHeaders(request),
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Category thumbnail upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { name: string } }) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/admin/thumbnails/categories/${encodeURIComponent(params.name)}`,
      {
        method: 'DELETE',
        headers: getAdminHeaders(request),
      },
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Category thumbnail reset error:', error);
    return NextResponse.json({ success: false, error: 'Reset failed' }, { status: 500 });
  }
}
