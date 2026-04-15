import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function proxyToBackend(request: NextRequest, method: string, path: string, body?: any) {
  // [SECURITY] H-1: httpOnly 쿠키에서 admin_token 추출
  const cookieHeader = request.headers.get('cookie') || '';
  const adminTokenMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]*)/);
  const adminToken = adminTokenMatch ? adminTokenMatch[1] : request.headers.get('x-admin-token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) headers['X-Admin-Token'] = adminToken;

  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BACKEND_URL}/api/v1/admin/auth${path}`, options);
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function GET(request: NextRequest) {
  return proxyToBackend(request, 'GET', '/accounts');
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyToBackend(request, 'POST', '/accounts', body);
}
