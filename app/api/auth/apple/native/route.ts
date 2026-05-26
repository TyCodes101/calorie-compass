import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Native Sign in with Apple is not available yet. Backend token verification is required before this route can issue a session.',
      code: 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
