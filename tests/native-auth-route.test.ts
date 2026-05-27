import { generateKeyPairSync, sign as signJwt } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST as postNativeAppleAuth } from '@/app/api/auth/apple/native/route';
import { POST as postNativeLogout } from '@/app/api/auth/logout/route';
import { appleIssuer } from '@/lib/auth/apple-token-verification';
import { validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

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
    }),
  );
}

describe('native Apple auth route safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects missing or invalid JSON before auth handling', async () => {
    const response = await postAppleAuth('not-json');
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
  });

  it('rejects missing identity tokens and never authenticates arbitrary clients', async () => {
    const response = await postAppleAuth({ provider: 'apple', email: 'attacker@example.com', name: 'Fake User' });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
  });

  it('fails closed when valid-shaped requests are missing server Apple audience config', async () => {
    const response = await postAppleAuth({ provider: 'apple', identityToken: 'header.payload.signature', nonce: 'nonce-123' });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('APPLE_TOKEN_CONFIG_MISSING');
  });

  it('rejects malformed configured Apple tokens without creating sessions', async () => {
    vi.stubEnv('APPLE_AUTH_AUDIENCE', 'com.caloriecompass.ios');

    const response = await postAppleAuth({ provider: 'apple', identityToken: 'header.payload.signature', nonce: 'nonce-123' });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('APPLE_TOKEN_INVALID');
  });

  it('returns verified Apple identity payload but no session for a valid mocked token', async () => {
    const { token, jwks } = createRouteJwt();
    vi.stubEnv('APPLE_AUTH_AUDIENCE', 'com.caloriecompass.ios');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(jwks), { status: 200, headers: { 'content-type': 'application/json' } })),
    );

    const response = await postAppleAuth({ provider: 'apple', identityToken: token });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('APPLE_IDENTITY_VERIFIED_NO_SESSION');
    expect(payload.sessionIssued).toBe(false);
    expect(payload.identity.provider).toBe('apple');
    expect(payload.identity.subject).toBe('route-apple-subject');
    expect(payload.remainingBeforeSession.join(' ')).toMatch(/Guest-to-account migration/i);
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
  it('is guest-safe and does not claim production session revocation yet', async () => {
    const response = await postNativeLogout();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.mode).toBe('guest');
    expect(payload.code).toBe('NATIVE_LOGOUT_GUEST_MODE');
    expect(payload.message).toMatch(/future backend-issued sessions/i);
  });
});
