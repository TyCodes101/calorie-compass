import { NextResponse } from 'next/server';

import { verifyAppleIdentityToken } from '@/lib/auth/apple-token-verification';
import { getNativeAuthScaffoldStatus, validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

function getExpectedAppleAudience() {
  return process.env.APPLE_AUTH_AUDIENCE ?? process.env.APPLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_APPLE_BUNDLE_ID;
}

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

  const verification = await verifyAppleIdentityToken({
    identityToken: validation.value.identityToken,
    expectedAudience: getExpectedAppleAudience(),
    nonce: validation.value.nonce,
  });

  if (!verification.ok) {
    const status = verification.code === 'APPLE_TOKEN_CONFIG_MISSING' ? 503 : 401;
    return NextResponse.json(
      {
        ok: false,
        error: verification.error,
        code: verification.code,
      },
      { status },
    );
  }

  const remainingBeforeSession = getNativeAuthScaffoldStatus().accountLifecycle.requiredBeforeEnablement;
  return NextResponse.json({
    ok: true,
    code: 'APPLE_IDENTITY_VERIFIED_NO_SESSION',
    sessionIssued: false,
    identity: {
      provider: 'apple',
      subject: verification.identity.subject,
      audience: verification.identity.audience,
      issuer: verification.identity.issuer,
      expiresAt: verification.identity.expiresAt,
      issuedAt: verification.identity.issuedAt,
      email: verification.identity.email,
      emailVerified: verification.identity.emailVerified,
    },
    remainingBeforeSession,
  });
}
