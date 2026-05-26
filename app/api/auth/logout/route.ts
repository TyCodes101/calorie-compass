import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Native logout is scaffolded but not wired to a production auth session yet.',
      code: 'NATIVE_LOGOUT_NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
