import { NextResponse } from 'next/server';

export async function POST() {
  // Phase 5A has no backend-issued native account session token yet, so logout
  // must not pretend to revoke one. This is an idempotent no-op contract for
  // native clients that keeps guest mode available and safe.
  return NextResponse.json({
    ok: true,
    mode: 'guest',
    code: 'NATIVE_LOGOUT_GUEST_MODE',
    message: 'No native account session is active. Guest mode remains available; future backend-issued sessions will be revoked here.',
  });
}
