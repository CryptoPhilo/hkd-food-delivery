import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/thumbnails/menus/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey && { 'X-Admin-Key': adminKey }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Menu thumbnail upload error:', error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const adminKey = request.headers.get('x-admin-key');

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/thumbnails/menus/${params.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey && { 'X-Admin-Key': adminKey }),
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Menu thumbnail reset error:', error);
    return NextResponse.json({ success: false, error: 'Reset failed' }, { status: 500 });
  }
}
