import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

async function proxyToBackend(request: NextRequest, method: string, path: string, body?: any) {
  const adminToken = request.headers.get('x-admin-token');
  const adminUser = request.headers.get('x-admin-user');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) headers['X-Admin-Token'] = adminToken;
  if (ADMIN_API_KEY) headers['X-Admin-Key'] = ADMIN_API_KEY;
  if (adminUser) headers['X-Admin-User'] = adminUser;

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
