import { beforeEach, describe, expect, it, vi } from 'vitest';

const { issueNativeGuestSession, hasDatabaseConnectionString } = vi.hoisted(() => ({
  issueNativeGuestSession: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
}));

vi.mock('@/lib/auth/native-session', () => ({
  issueNativeGuestSession,
}));

vi.mock('@/lib/current-user', () => ({
  hasDatabaseConnectionString,
}));

import { POST } from '@/app/api/session/guest/route';

describe('native guest bootstrap route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a guest backend session for first native launch without requiring sign-in', async () => {
    hasDatabaseConnectionString.mockReturnValue(true);
    issueNativeGuestSession.mockResolvedValue({
      token: 'guest-token',
      expiresAt: new Date('2026-06-27T03:48:00.000Z'),
      user: {
        id: 'guest-user-1',
        name: 'Guest',
        email: null,
        demo: true,
      },
    });

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      account: { mode: 'guest' },
      user: { id: 'guest-user-1', name: null, mode: 'guest' },
      session: {
        token: 'guest-token',
        expiresAt: '2026-06-27T03:48:00.000Z',
        tokenType: 'Bearer',
      },
    });
  });

  it('returns local guest bootstrap data when persistence is unavailable for tests/dev', async () => {
    hasDatabaseConnectionString.mockReturnValue(false);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.account.mode).toBe('guest');
    expect(payload.user.mode).toBe('guest');
    expect(payload.session.token).toBe('local-demo-native-session');
    expect(issueNativeGuestSession).not.toHaveBeenCalled();
  });
});
