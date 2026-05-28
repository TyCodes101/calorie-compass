import { describe, expect, it, vi } from 'vitest';

import type { VerifiedAppleIdentity } from '@/lib/auth/apple-token-verification';
import {
  getNativeSessionExpiresAt,
  hashNativeSessionToken,
  issueNativeGuestSession,
  isNativeSessionExpired,
  issueNativeSessionForAppleIdentity,
  nativeSessionTtlMs,
  revokeNativeSessionToken,
} from '@/lib/auth/native-session';

function identity(overrides: Partial<VerifiedAppleIdentity> = {}): VerifiedAppleIdentity {
  return {
    subject: 'apple-sub-1',
    audience: 'com.caloriecompass.ios',
    issuer: 'https://appleid.apple.com',
    issuedAt: 1_700_000_000,
    expiresAt: 2_000_000_000,
    email: 'verified@example.com',
    emailVerified: true,
    ...overrides,
  };
}

function createSessionClient() {
  const tx = {
    userAuthProvider: {
      upsert: vi.fn(),
    },
    nativeSession: {
      create: vi.fn(),
    },
  };
  const client = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  tx.userAuthProvider.upsert.mockResolvedValue({
    userId: 'user-1',
    user: {
      id: 'user-1',
      name: 'Apple User',
      email: null,
      demo: false,
    },
  });
  tx.nativeSession.create.mockResolvedValue({ id: 'session-1' });

  return { client, tx };
}

describe('native session helpers', () => {
  it('hashes native session tokens before persistence', () => {
    const hash = hashNativeSessionToken('server-issued-token');

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash).not.toContain('server-issued-token');
  });

  it('calculates bounded session expiry and expiration checks', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');
    const expiresAt = getNativeSessionExpiresAt(now);

    expect(expiresAt.getTime() - now.getTime()).toBe(nativeSessionTtlMs);
    expect(isNativeSessionExpired({ expiresAt }, now)).toBe(false);
    expect(isNativeSessionExpired({ expiresAt }, expiresAt)).toBe(true);
  });

  it('creates or links users by verified Apple subject and issues a server token', async () => {
    const { client, tx } = createSessionClient();

    const issued = await issueNativeSessionForAppleIdentity({
      identity: identity(),
      now: new Date('2026-05-27T12:00:00.000Z'),
      tokenFactory: () => 'raw-server-token',
      client,
    });

    expect(issued).toMatchObject({
      token: 'raw-server-token',
      provider: 'apple',
      providerSubject: 'apple-sub-1',
      user: { id: 'user-1', demo: false },
    });
    expect(tx.userAuthProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerSubject: {
            provider: 'apple',
            providerSubject: 'apple-sub-1',
          },
        },
        create: expect.objectContaining({
          provider: 'apple',
          providerSubject: 'apple-sub-1',
          email: 'verified@example.com',
          user: { create: { name: 'Apple User', demo: false } },
        }),
      }),
    );
    expect(tx.nativeSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tokenHash: hashNativeSessionToken('raw-server-token'),
        expiresAt: new Date('2026-06-26T12:00:00.000Z'),
      },
    });
  });

  it('does not trust unverified Apple email claims while linking accounts', async () => {
    const { client, tx } = createSessionClient();

    await issueNativeSessionForAppleIdentity({
      identity: identity({ email: 'unverified@example.com', emailVerified: false }),
      tokenFactory: () => 'raw-server-token',
      client,
    });

    expect(tx.userAuthProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: null, emailVerified: false }),
        update: { email: null, emailVerified: false },
      }),
    );
  });

  it('issues a guest native session with a default profile instead of requiring sign-in', async () => {
    const tx = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: 'guest-user-1',
          name: 'Guest',
          email: null,
          demo: true,
        }),
      },
      userAuthProvider: { upsert: vi.fn() },
      nativeSession: { create: vi.fn().mockResolvedValue({ id: 'session-1' }) },
    };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const issued = await issueNativeGuestSession({
      now: new Date('2026-05-28T03:48:00.000Z'),
      tokenFactory: () => 'guest-token',
      client,
    });

    expect(issued).toMatchObject({
      token: 'guest-token',
      user: { id: 'guest-user-1', demo: true },
    });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Guest',
        demo: true,
        profile: {
          create: expect.objectContaining({
            goal: 'MAINTAIN',
            activityLevel: 'MODERATE',
            dailyCalorieGoal: 2200,
            proteinGoal: 160,
          }),
        },
      }),
    });
    expect(tx.nativeSession.create).toHaveBeenCalledWith({
      data: {
        userId: 'guest-user-1',
        tokenHash: hashNativeSessionToken('guest-token'),
        expiresAt: new Date('2026-06-27T03:48:00.000Z'),
      },
    });
  });

  it('revokes active sessions and treats missing logout as guest-safe', async () => {
    const client = {
      nativeSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'session-1',
          expiresAt: new Date('2026-05-28T12:00:00.000Z'),
          revokedAt: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };
    vi.stubEnv('DATABASE_URL', 'postgresql://unit-test');

    await expect(
      revokeNativeSessionToken('raw-server-token', {
        now: new Date('2026-05-27T12:00:00.000Z'),
        client,
      }),
    ).resolves.toEqual({ revoked: true, reason: 'revoked' });
    expect(client.nativeSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashNativeSessionToken('raw-server-token') },
      select: { id: true, expiresAt: true, revokedAt: true },
    });
    expect(client.nativeSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { revokedAt: new Date('2026-05-27T12:00:00.000Z') },
    });

    await expect(revokeNativeSessionToken(null)).resolves.toEqual({ revoked: false, reason: 'missing_token' });
    vi.unstubAllEnvs();
  });
});
