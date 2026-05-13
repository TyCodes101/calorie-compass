import { NextResponse } from 'next/server';

import { getDashboardData } from '@/lib/dashboard';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? new Date().toISOString();
  const dashboard = await getDashboardData(date);

  if (!dashboard) {
    return NextResponse.json({ error: 'No user profile found.' }, { status: 404 });
  }

  return NextResponse.json(dashboard);
}
