import { describe, expect, it } from 'vitest';

import { POST as postNativeAppleAuth } from '@/app/api/auth/apple/native/route';
import { POST as postNativeLogout } from '@/app/api/auth/logout/route';
import { validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

describe('native Apple auth route safety', () => {
  it('rejects missing or invalid JSON before auth handling', async () => {
    const response = await postNativeAppleAuth(new Request('http://localhost/api/auth/apple/native', { method: 'POST', body: 'not-json' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
  });

  it('rejects missing identity tokens and never authenticates arbitrary clients', async () => {
    const response = await postNativeAppleAuth(
      new Request('http://localhost/api/auth/apple/native', {
        method: 'POST',
        body: JSON.stringify({ provider: 'apple', email: 'attacker@example.com', name: 'Fake User' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('INVALID_NATIVE_AUTH_REQUEST');
  });

  it('keeps valid-shaped Apple auth requests guarded until real Apple verification exists', async () => {
    const response = await postNativeAppleAuth(
      new Request('http://localhost/api/auth/apple/native', {
        method: 'POST',
        body: JSON.stringify({ provider: 'apple', identityToken: 'header.payload.signature', nonce: 'nonce-123' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('NATIVE_APPLE_AUTH_NOT_IMPLEMENTED');
    expect(payload.error).toMatch(/not available yet/i);
    expect(payload.requiredBeforeEnablement.join(' ')).toMatch(/Apple public keys|JWKS/i);
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
