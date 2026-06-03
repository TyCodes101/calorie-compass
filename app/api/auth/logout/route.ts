import { NextResponse } from 'next/server';

import { readNativeSessionTokenFromRequest, revokeNativeSessionToken } from '@/lib/auth/native-session';

export async function POST(request: Request) {
  const sessionToken = await readNativeSessionTokenFromRequest(request);
  const result = await revokeNativeSessionToken(sessionToken);

  if (result.revoked) {
    return NextResponse.json({
      ok: true,
      mode: 'guest',
      code: 'NATIVE_SESSION_REVOKED',
      revoked: true,
      message: 'Native account session was signed out. Guest mode remains available.',
    });
  }

  if (result.reason === 'not_found' || result.reason === 'already_revoked') {
    return NextResponse.json({
      ok: true,
      mode: 'guest',
      code: 'NATIVE_SESSION_NOT_FOUND',
      revoked: false,
      message: 'No active native account session was found. Guest mode remains available.',
    });
  }

  return NextResponse.json({
    ok: true,
    mode: 'guest',
    code: 'NATIVE_LOGOUT_GUEST_MODE',
    revoked: false,
    message: 'No native account session is active. Guest mode remains available.',
  });
}
