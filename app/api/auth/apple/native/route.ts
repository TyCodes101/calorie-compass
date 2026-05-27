import { NextResponse } from 'next/server';

import { verifyAppleIdentityToken } from '@/lib/auth/apple-token-verification';
import { getNativeAuthScaffoldStatus, validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';
import { hasNativeSessionPersistence, issueNativeSessionForAppleIdentity } from '@/lib/auth/native-session';

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

  const verifiedIdentity = {
    provider: 'apple' as const,
    subject: verification.identity.subject,
    audience: verification.identity.audience,
    issuer: verification.identity.issuer,
    expiresAt: verification.identity.expiresAt,
    issuedAt: verification.identity.issuedAt,
    email: verification.identity.email,
    emailVerified: verification.identity.emailVerified,
  };

  if (!hasNativeSessionPersistence()) {
    return NextResponse.json(
      {
        ok: false,
        code: 'NATIVE_SESSION_PERSISTENCE_UNAVAILABLE',
        error: 'Durable database persistence is required before a native account session can be issued.',
        identity: verifiedIdentity,
      },
      { status: 503 },
    );
  }

  try {
    const issued = await issueNativeSessionForAppleIdentity({ identity: verification.identity });
    return NextResponse.json({
      ok: true,
      code: 'NATIVE_APPLE_SESSION_ISSUED',
      sessionIssued: true,
      identity: verifiedIdentity,
      account: {
        mode: 'account',
        userId: issued.user.id,
        provider: issued.provider,
        canUpgradeGuest: false,
      },
      session: {
        token: issued.token,
        expiresAt: issued.expiresAt.toISOString(),
        tokenType: 'Bearer',
      },
      remainingBeforeFullNativeAuth: getNativeAuthScaffoldStatus().accountLifecycle.requiredBeforeEnablement,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: 'NATIVE_SESSION_PERSISTENCE_FAILED',
        error: 'Apple identity was verified, but the native session could not be persisted.',
      },
      { status: 500 },
    );
  }
}
