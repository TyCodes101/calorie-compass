import { generateKeyPairSync, sign as signJwt } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as postNativeAppleAuth } from '@/app/api/auth/apple/native/route';
import { POST as postNativeLogout } from '@/app/api/auth/logout/route';
import { appleIssuer } from '@/lib/auth/apple-token-verification';
import { hashNativeSessionToken } from '@/lib/auth/native-session';
import { validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

const prismaMocks = vi.hoisted(() => {
  const tx = {
    userAuthProvider: {
      upsert: vi.fn(),
    },
    nativeSession: {
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    nativeSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMocks.prisma,
}));

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function createRouteJwt() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', kid: 'route-key', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: appleIssuer,
      aud: 'com.caloriecompass.ios',
      sub: 'route-apple-subject',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000) - 60,
      email: 'route@example.com',
      email_verified: true,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = signJwt('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');

  return {
    token: `${signingInput}.${signature}`,
    jwks: { keys: [{ ...publicJwk, kid: 'route-key', alg: 'RS256', use: 'sig', kty: 'RSA' }] },
  };
}

function postAppleAuth(body: unknown) {
  return postNativeAppleAuth(
    new Request('http://localhost/api/auth/apple/native', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function postLogout({ token }: { token?: string } = {}) {
  return postNativeLogout(
    new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    }),
  );
}

describe('native Apple auth route safety', () => {
  beforeEach(() => {
    prismaMocks.prisma.$transaction.mockImplementation(async (callback) => callback(prismaMocks.tx));
    prismaMocks.tx.userAuthProvider.upsert.mockResolvedValue({
      userId: 'user-apple-1',
      user: {
        id: 'user-apple-1',
        name: 'Apple User',
        email: null,
        demo: false,
      },
    });
    prismaMocks.tx.nativeSession.create.mockResolvedValue({ id: 'native-session-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects missing or invalid JSON before auth handling', async () => {
    const response = await postAppleAuth('not-json');
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects missing identity tokens and never authenticates arbitrary clients', async () => {
    const response = await postAppleAuth({ provider: 'apple', email: 'attacker@example.com', name: 'Fake User' });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when valid-shaped requests are missing server Apple audience config', async () => {
    const response = await postAppleAuth({ provider: 'apple', identityToken: 'header.payload.signature', nonce: 'nonce-123' });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('APPLE_TOKEN_CONFIG_MISSING');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed configured Apple tokens without creating sessions', async () => {
    vi.stubEnv('APPLE_AUTH_AUDIENCE', 'com.caloriecompass.ios');
    vi.stubEnv('DATABASE_URL', 'postgresql://unit-test');

    const response = await postAppleAuth({ provider: 'apple', identityToken: 'header.payload.signature', nonce: 'nonce-123' });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('APPLE_TOKEN_INVALID');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create fake sessions when durable persistence is unavailable', async () => {
    const { token, jwks } = createRouteJwt();
    vi.stubEnv('APPLE_AUTH_AUDIENCE', 'com.caloriecompass.ios');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200, headers: { 'content-type': 'application/json' } })),
    );

    const response = await postAppleAuth({ provider: 'apple', identityToken: token });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('NATIVE_SESSION_PERSISTENCE_UNAVAILABLE');
    expect(payload.identity.subject).toBe('route-apple-subject');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('links verified Apple identity and issues a server-generated native session', async () => {
    const { token, jwks } = createRouteJwt();
    vi.stubEnv('APPLE_AUTH_AUDIENCE', 'com.caloriecompass.ios');
    vi.stubEnv('DATABASE_URL', 'postgresql://unit-test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200, headers: { 'content-type': 'application/json' } })),
    );

    const response = await postAppleAuth({ provider: 'apple', identityToken: token });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('NATIVE_APPLE_SESSION_ISSUED');
    expect(payload.sessionIssued).toBe(true);
    expect(payload.identity.provider).toBe('apple');
    expect(payload.identity.subject).toBe('route-apple-subject');
    expect(payload.account).toMatchObject({ mode: 'account', userId: 'user-apple-1', provider: 'apple' });
    expect(payload.session.token).toEqual(expect.any(String));
    expect(payload.session.token).not.toBe(token);
    expect(payload.session.tokenType).toBe('Bearer');
    expect(payload.remainingBeforeFullNativeAuth.join(' ')).toMatch(/real-device QA/i);
    expect(payload.remainingBeforeFullNativeAuth.join(' ')).toMatch(/account deletion verification/i);
    expect(prismaMocks.tx.userAuthProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerSubject: {
            provider: 'apple',
            providerSubject: 'route-apple-subject',
          },
        },
      }),
    );
    expect(prismaMocks.tx.nativeSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-apple-1',
        tokenHash: hashNativeSessionToken(payload.session.token),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('validates native Apple auth request shape without trusting identity fields', () => {
    const result = validateNativeAppleAuthRequest({
      provider: 'apple',
      identityToken: 'token',
      guestSessionId: 'guest-session',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe('apple');
      expect(result.value.identityToken).toBe('token');
      expect(result.value.guestSessionId).toBe('guest-session');
    }
  });
});

describe('native logout contract', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('is guest-safe when no native account session exists', async () => {
    const response = await postLogout();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.mode).toBe('guest');
    expect(payload.code).toBe('NATIVE_LOGOUT_GUEST_MODE');
    expect(payload.revoked).toBe(false);
    expect(payload.message).toMatch(/guest mode remains available/i);
  });

  it('revokes a backend-issued native session token without deleting account data', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://unit-test');
    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValue({
      id: 'native-session-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    prismaMocks.prisma.nativeSession.update.mockResolvedValue({ id: 'native-session-1' });

    const response = await postLogout({ token: 'server-issued-token' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('NATIVE_SESSION_REVOKED');
    expect(payload.revoked).toBe(true);
    expect(prismaMocks.prisma.nativeSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashNativeSessionToken('server-issued-token') },
      select: { id: true, expiresAt: true, revokedAt: true },
    });
    expect(prismaMocks.prisma.nativeSession.update).toHaveBeenCalledWith({
      where: { id: 'native-session-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
