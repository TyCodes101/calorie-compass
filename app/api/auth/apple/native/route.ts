import { NextResponse } from 'next/server';

import { buildNativeAppleAuthNotImplementedResponse, validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Request body must be valid JSON.',
        code: 'INVALID_NATIVE_AUTH_REQUEST',
      },
      { status: 400 },
    );
  }

  const validation = validateNativeAppleAuthRequest(body);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: validation.error,
        code: 'INVALID_NATIVE_AUTH_REQUEST',
      },
      { status: 400 },
    );
  }

  // Safety boundary: do not authenticate from client-provided identityToken yet.
  // TODO(Phase 5B+): verify Apple JWT issuer/audience/signature/expiry/nonce via
  // Apple public keys, then issue a backend-owned session token.
  return NextResponse.json(buildNativeAppleAuthNotImplementedResponse(), { status: 501 });
}
