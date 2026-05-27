import { generateKeyPairSync, sign as signJwt } from 'crypto';
import { describe, expect, it } from 'vitest';

import { appleIssuer, verifyAppleIdentityToken } from '@/lib/auth/apple-token-verification';

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function createAppleJwt({
  claims = {},
  header = {},
  privateKey,
}: {
  claims?: Record<string, unknown>;
  header?: Record<string, unknown>;
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
}) {
  const encodedHeader = encodeBase64Url(JSON.stringify({ alg: 'RS256', kid: 'test-key', typ: 'JWT', ...header }));
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      iss: appleIssuer,
      aud: 'com.caloriecompass.ios',
      sub: 'apple-user-subject',
      exp: 2_000_000_000,
      iat: 1_700_000_000,
      email: 'verified@example.com',
      email_verified: 'true',
      ...claims,
    }),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signJwt('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

function createKeyFixture() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  return {
    privateKey,
    jwks: {
      keys: [
        {
          ...publicJwk,
          kid: 'test-key',
          alg: 'RS256',
          use: 'sig',
          kty: 'RSA',
        },
      ],
    },
  };
}

describe('Apple identity token verification', () => {
  it('fails closed when Apple audience config is missing', async () => {
    const { privateKey, jwks } = createKeyFixture();
    const token = createAppleJwt({ privateKey });

    const result = await verifyAppleIdentityToken({
      identityToken: token,
      fetchJwks: async () => jwks,
      nowSeconds: 1_800_000_000,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('APPLE_TOKEN_CONFIG_MISSING');
  });

  it('rejects malformed tokens', async () => {
    const result = await verifyAppleIdentityToken({
      identityToken: 'not.a.valid.jwt',
      expectedAudience: 'com.caloriecompass.ios',
      fetchJwks: async () => ({ keys: [] }),
      nowSeconds: 1_800_000_000,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('APPLE_TOKEN_INVALID');
  });

  it('rejects invalid issuer, audience, and expired tokens', async () => {
    const { privateKey, jwks } = createKeyFixture();

    await expect(
      verifyAppleIdentityToken({
        identityToken: createAppleJwt({ privateKey, claims: { iss: 'https://evil.example' } }),
        expectedAudience: 'com.caloriecompass.ios',
        fetchJwks: async () => jwks,
        nowSeconds: 1_800_000_000,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'APPLE_TOKEN_INVALID' });

    await expect(
      verifyAppleIdentityToken({
        identityToken: createAppleJwt({ privateKey, claims: { aud: 'wrong-audience' } }),
        expectedAudience: 'com.caloriecompass.ios',
        fetchJwks: async () => jwks,
        nowSeconds: 1_800_000_000,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'APPLE_TOKEN_INVALID' });

    await expect(
      verifyAppleIdentityToken({
        identityToken: createAppleJwt({ privateKey, claims: { exp: 1_700_000_001 } }),
        expectedAudience: 'com.caloriecompass.ios',
        fetchJwks: async () => jwks,
        nowSeconds: 1_800_000_000,
      }),
    ).resolves.toMatchObject({ ok: false, code: 'APPLE_TOKEN_INVALID' });
  });

  it('rejects nonce mismatches', async () => {
    const { privateKey, jwks } = createKeyFixture();
    const token = createAppleJwt({ privateKey, claims: { nonce: 'expected-nonce' } });

    const result = await verifyAppleIdentityToken({
      identityToken: token,
      expectedAudience: 'com.caloriecompass.ios',
      nonce: 'other-nonce',
      fetchJwks: async () => jwks,
      nowSeconds: 1_800_000_000,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('APPLE_TOKEN_INVALID');
  });

  it('verifies a valid mocked Apple JWT with JWKS and returns verified identity only', async () => {
    const { privateKey, jwks } = createKeyFixture();
    const token = createAppleJwt({ privateKey, claims: { nonce: 'nonce-123' } });

    const result = await verifyAppleIdentityToken({
      identityToken: token,
      expectedAudience: 'com.caloriecompass.ios',
      nonce: 'nonce-123',
      fetchJwks: async () => jwks,
      nowSeconds: 1_800_000_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.subject).toBe('apple-user-subject');
      expect(result.identity.audience).toBe('com.caloriecompass.ios');
      expect(result.identity.email).toBe('verified@example.com');
      expect(result.identity.emailVerified).toBe(true);
    }
  });
});
