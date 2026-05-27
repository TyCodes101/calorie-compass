import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE as deleteNativeAccount } from '@/app/api/account/native/delete/route';
import { GET as getNativeExport } from '@/app/api/account/native/export/route';
import { POST as postGuestMigration } from '@/app/api/auth/guest/migrate/route';
import { guestSessionCookieName } from '@/lib/auth-session';
import { hashNativeSessionToken } from '@/lib/auth/native-session';

const prismaMocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    meal: {
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    reusableMeal: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    dailyLog: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    weightEntry: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    userAuthProvider: {
      deleteMany: vi.fn(),
    },
    nativeSession: {
      updateMany: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    nativeSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    meal: {
      findMany: vi.fn(),
    },
    reusableMeal: {
      findMany: vi.fn(),
    },
    dailyLog: {
      findMany: vi.fn(),
    },
    weightEntry: {
      findMany: vi.fn(),
    },
    userAuthProvider: {
      findMany: vi.fn(),
    },
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMocks.prisma,
}));

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost${path}`, init);
}

function authHeaders(token = 'server-issued-token', extra: HeadersInit = {}) {
  return {
    authorization: `Bearer ${token}`,
    ...extra,
  };
}

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'native-session-1',
    userId: 'account-user-1',
    expiresAt: new Date('2026-06-27T12:00:00.000Z'),
    revokedAt: null,
    user: {
      id: 'account-user-1',
      name: 'Apple User',
      email: null,
      demo: false,
      profile: null,
    },
    ...overrides,
  };
}

describe('native account lifecycle routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgresql://unit-test');
    vi.setSystemTime(new Date('2026-05-27T12:00:00.000Z'));
    prismaMocks.prisma.$transaction.mockImplementation(async (callback) => callback(prismaMocks.tx));
    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValue(activeSession());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('requires a valid native bearer session before migrating guest data', async () => {
    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValue(null);

    const response = await postGuestMigration(
      request('/api/auth/guest/migrate', {
        method: 'POST',
        headers: {
          cookie: `${guestSessionCookieName}=guest-session-1`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId: 'attacker-controlled-user' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('NATIVE_SESSION_REQUIRED');
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('migrates cookie-scoped guest data into the authenticated account without trusting client user ids', async () => {
    prismaMocks.tx.user.findUnique.mockResolvedValue({
      id: 'guest-user-1',
      email: 'guest-session-1@guest.caloriecompass.local',
      demo: true,
    });
    prismaMocks.tx.userProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'guest-profile-1', userId: 'guest-user-1' });
    prismaMocks.tx.userProfile.update.mockResolvedValue({ id: 'guest-profile-1' });
    prismaMocks.tx.meal.updateMany.mockResolvedValue({ count: 2 });
    prismaMocks.tx.reusableMeal.findMany.mockResolvedValue([{ id: 'favorite-1', sourceMealId: null }]);
    prismaMocks.tx.reusableMeal.updateMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.dailyLog.findMany
      .mockResolvedValueOnce([{ id: 'log-1', date: new Date('2026-05-27T00:00:00.000Z') }])
      .mockResolvedValueOnce([]);
    prismaMocks.tx.dailyLog.updateMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.weightEntry.updateMany.mockResolvedValue({ count: 1 });

    const response = await postGuestMigration(
      request('/api/auth/guest/migrate', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          cookie: `${guestSessionCookieName}=guest-session-1`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ userId: 'attacker-controlled-user' }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('GUEST_DATA_MIGRATION_COMPLETED');
    expect(payload.result.accountUserId).toBe('account-user-1');
    expect(payload.result.guestUserId).toBe('guest-user-1');
    expect(payload.result.migrated).toMatchObject({
      profile: 1,
      meals: 2,
      reusableMeals: 1,
      dailyLogs: 1,
      weightEntries: 1,
    });
    expect(prismaMocks.prisma.nativeSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashNativeSessionToken('server-issued-token') },
      }),
    );
    expect(prismaMocks.tx.meal.updateMany).toHaveBeenCalledWith({
      where: { userId: 'guest-user-1' },
      data: { userId: 'account-user-1' },
    });
    expect(prismaMocks.tx.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'guest-session-1@guest.caloriecompass.local' },
      select: { id: true, email: true, demo: true },
    });
  });

  it('makes guest migration duplicate-safe when account data already exists', async () => {
    prismaMocks.tx.user.findUnique.mockResolvedValue({
      id: 'guest-user-1',
      email: 'guest-session-1@guest.caloriecompass.local',
      demo: true,
    });
    prismaMocks.tx.userProfile.findUnique
      .mockResolvedValueOnce({ id: 'account-profile-1', userId: 'account-user-1' })
      .mockResolvedValueOnce({ id: 'guest-profile-1', userId: 'guest-user-1' });
    prismaMocks.tx.meal.updateMany.mockResolvedValue({ count: 0 });
    prismaMocks.tx.reusableMeal.findMany
      .mockResolvedValueOnce([{ id: 'favorite-1', sourceMealId: 'meal-1' }])
      .mockResolvedValueOnce([{ id: 'existing-favorite-1', sourceMealId: 'meal-1' }]);
    prismaMocks.tx.dailyLog.findMany
      .mockResolvedValueOnce([{ id: 'log-1', date: new Date('2026-05-27T00:00:00.000Z') }])
      .mockResolvedValueOnce([{ id: 'account-log-1', date: new Date('2026-05-27T00:00:00.000Z') }]);
    prismaMocks.tx.weightEntry.updateMany.mockResolvedValue({ count: 0 });

    const response = await postGuestMigration(
      request('/api/auth/guest/migrate', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          cookie: `${guestSessionCookieName}=guest-session-1`,
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result.skipped).toMatchObject({
      profile: 1,
      reusableMeals: 1,
      dailyLogs: 1,
    });
    expect(prismaMocks.tx.userProfile.update).not.toHaveBeenCalled();
    expect(prismaMocks.tx.reusableMeal.updateMany).not.toHaveBeenCalled();
    expect(prismaMocks.tx.dailyLog.updateMany).not.toHaveBeenCalled();
  });

  it('exports only the authenticated native account data', async () => {
    prismaMocks.prisma.user.findUnique.mockResolvedValue({
      id: 'account-user-1',
      name: 'Apple User',
      email: null,
      demo: false,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-02T00:00:00.000Z'),
      profile: null,
    });
    prismaMocks.prisma.meal.findMany.mockResolvedValue([{ id: 'meal-1', userId: 'account-user-1', items: [] }]);
    prismaMocks.prisma.reusableMeal.findMany.mockResolvedValue([]);
    prismaMocks.prisma.dailyLog.findMany.mockResolvedValue([]);
    prismaMocks.prisma.weightEntry.findMany.mockResolvedValue([]);
    prismaMocks.prisma.userAuthProvider.findMany.mockResolvedValue([
      {
        id: 'provider-1',
        provider: 'apple',
        providerSubject: 'apple-subject',
        email: 'verified@example.com',
        emailVerified: true,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    prismaMocks.prisma.nativeSession.findMany.mockResolvedValue([
      {
        id: 'native-session-1',
        expiresAt: new Date('2026-06-27T12:00:00.000Z'),
        revokedAt: null,
        createdAt: new Date('2026-05-27T12:00:00.000Z'),
        updatedAt: new Date('2026-05-27T12:00:00.000Z'),
      },
    ]);

    const response = await getNativeExport(request('/api/account/native/export', { headers: authHeaders() }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('NATIVE_ACCOUNT_EXPORT_READY');
    expect(payload.account.userId).toBe('account-user-1');
    expect(payload.meals).toHaveLength(1);
    expect(payload.authProviders[0]).toMatchObject({ provider: 'apple', providerSubject: 'apple-subject' });
    expect(payload.nativeSessions[0]).not.toHaveProperty('tokenHash');
    expect(prismaMocks.prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'account-user-1' },
      }),
    );
    expect(prismaMocks.prisma.meal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'account-user-1' },
      }),
    );
  });

  it('requires a native session for export and delete endpoints', async () => {
    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValue(null);

    const exportResponse = await getNativeExport(request('/api/account/native/export'));
    const deleteResponse = await deleteNativeAccount(request('/api/account/native/delete', { method: 'DELETE' }));

    await expect(exportResponse.json()).resolves.toMatchObject({ ok: false, code: 'NATIVE_SESSION_REQUIRED' });
    await expect(deleteResponse.json()).resolves.toMatchObject({ ok: false, code: 'NATIVE_SESSION_REQUIRED' });
    expect(exportResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
  });

  it('does not fake account lifecycle sessions when durable persistence is unavailable', async () => {
    vi.unstubAllEnvs();

    const response = await getNativeExport(request('/api/account/native/export', { headers: authHeaders() }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('NATIVE_SESSION_PERSISTENCE_UNAVAILABLE');
    expect(prismaMocks.prisma.nativeSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects revoked and expired native sessions before account lifecycle work', async () => {
    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValueOnce(
      activeSession({ revokedAt: new Date('2026-05-27T11:00:00.000Z') }),
    );
    const revokedResponse = await getNativeExport(request('/api/account/native/export', { headers: authHeaders() }));

    prismaMocks.prisma.nativeSession.findUnique.mockResolvedValueOnce(
      activeSession({ expiresAt: new Date('2026-05-27T11:59:59.000Z') }),
    );
    const expiredResponse = await deleteNativeAccount(request('/api/account/native/delete', { method: 'DELETE', headers: authHeaders() }));

    await expect(revokedResponse.json()).resolves.toMatchObject({ ok: false, code: 'NATIVE_SESSION_REVOKED' });
    await expect(expiredResponse.json()).resolves.toMatchObject({ ok: false, code: 'NATIVE_SESSION_EXPIRED' });
    expect(revokedResponse.status).toBe(401);
    expect(expiredResponse.status).toBe(401);
    expect(prismaMocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes only the authenticated native account scope and revokes its active sessions', async () => {
    prismaMocks.tx.userProfile.deleteMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.meal.deleteMany.mockResolvedValue({ count: 2 });
    prismaMocks.tx.reusableMeal.deleteMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.dailyLog.deleteMany.mockResolvedValue({ count: 3 });
    prismaMocks.tx.weightEntry.deleteMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.userAuthProvider.deleteMany.mockResolvedValue({ count: 1 });
    prismaMocks.tx.nativeSession.updateMany.mockResolvedValue({ count: 2 });
    prismaMocks.tx.user.delete.mockResolvedValue({ id: 'account-user-1' });

    const response = await deleteNativeAccount(request('/api/account/native/delete', { method: 'DELETE', headers: authHeaders() }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.code).toBe('NATIVE_ACCOUNT_DELETED');
    expect(payload.deleted).toMatchObject({
      profile: 1,
      meals: 2,
      reusableMeals: 1,
      dailyLogs: 3,
      weightEntries: 1,
      authProviders: 1,
    });
    expect(payload.revokedSessions).toBe(2);
    expect(prismaMocks.tx.nativeSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'account-user-1', revokedAt: null },
      data: { revokedAt: new Date('2026-05-27T12:00:00.000Z') },
    });
    expect(prismaMocks.tx.user.delete).toHaveBeenCalledWith({
      where: { id: 'account-user-1' },
    });
  });
});
