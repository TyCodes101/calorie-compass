import { describe, expect, it } from 'vitest';

import { buildAccountFoundationSnapshot, buildGuestUserEmail, getPreferredUserName, isGuestEmail, isGuestUser } from '@/lib/auth-session';

describe('auth session helpers', () => {
  it('builds stable guest emails and detects guest users', () => {
    const email = buildGuestUserEmail('session-123');

    expect(email).toBe('session-123@guest.caloriecompass.local');
    expect(isGuestEmail(email)).toBe(true);
    expect(isGuestUser({ name: 'Guest', email, demo: true })).toBe(true);
  });

  it('suppresses placeholder guest names but keeps real names', () => {
    expect(getPreferredUserName({ name: 'Guest', email: buildGuestUserEmail('abc'), demo: true })).toBeNull();
    expect(getPreferredUserName({ name: 'Tyler', email: buildGuestUserEmail('abc'), demo: true })).toBe('Tyler');
    expect(getPreferredUserName({ name: 'Tyler', email: 'tyler@example.com', demo: false })).toBe('Tyler');
  });

  it('builds a guest-friendly account foundation snapshot', () => {
    const snapshot = buildAccountFoundationSnapshot({
      id: 'user-1',
      name: 'Guest',
      email: buildGuestUserEmail('session-123'),
      demo: true,
    });

    expect(snapshot.mode).toBe('guest');
    expect(snapshot.title).toMatch(/guest mode/i);
    expect(snapshot.providers).toHaveLength(2);
    expect(snapshot.providers[0]?.label).toMatch(/apple/i);
    expect(snapshot.providers[1]?.label).toMatch(/google/i);
  });
});
