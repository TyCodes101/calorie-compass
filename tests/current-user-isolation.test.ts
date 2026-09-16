import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  getUserForNativeSessionToken: vi.fn(),
  userFindFirst: vi.fn(),
  userUpsert: vi.fn(),
  userUpdate: vi.fn(),
  profileUpsert: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock('@/lib/auth/native-session', () => ({
  getUserForNativeSessionToken: mocks.getUserForNativeSessionToken,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      upsert: mocks.userUpsert,
      update: mocks.userUpdate,
    },
    userProfile: { upsert: mocks.profileUpsert },
  },
}));

import { getCurrentUserId, getCurrentUserWithProfile } from '@/lib/current-user';

describe('current-user isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgresql://configured-for-test');
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
    mocks.headers.mockResolvedValue({ get: vi.fn(() => null) });
    mocks.getUserForNativeSessionToken.mockResolvedValue(null);
    mocks.userFindFirst.mockResolvedValue({ id: 'oldest-user' });
    mocks.userUpsert.mockReset();
    mocks.userUpdate.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('never falls back to another database user without a session', async () => {
    await expect(getCurrentUserWithProfile()).resolves.toBeNull();
    await expect(getCurrentUserId()).resolves.toBeNull();
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
  });

  it('uses a database upsert for concurrent first-request guest creation', async () => {
    const guest = {
      id: 'guest-user',
      name: 'Guest',
      email: 'guest-session@guest.caloriecompass.local',
      demo: true,
    };
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: 'guest-session' })),
    });
    mocks.userUpsert.mockResolvedValue(guest);
    const profile = { id: 'guest-profile', userId: guest.id };
    mocks.profileUpsert.mockResolvedValue(profile);

    await expect(Promise.all([
      getCurrentUserWithProfile(),
      getCurrentUserWithProfile(),
      getCurrentUserId(),
    ])).resolves.toEqual([{ ...guest, profile }, { ...guest, profile }, guest.id]);

    expect(mocks.userUpsert).toHaveBeenCalledTimes(3);
    expect(mocks.userUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'guest-session@guest.caloriecompass.local' },
      update: {},
    }));
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.profileUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.profileUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: guest.id }, update: {},
    }));
  });
});
