import { describe, expect, it } from 'vitest';

import { buildAccountFoundationSnapshot, buildGuestUserEmail, getPreferredUserName, isGuestEmail, isGuestUser } from '@/lib/auth-session';
import { buildNativeAppleAuthNotImplementedResponse, getNativeAuthScaffoldStatus, validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

describe('auth session helpers', () => {
  it('builds stable guest emails and detects guest users', () => {
    const email = buildGuestUserEmail('session-123');

    expect(email).toBe('session-123@guest.caloriecompass.local');
    expect(isGuestEmail(email)).toBe(true);
    expect(isGuestUser({ name: 'Guest', email, demo: true })).toBe(true);
    expect(isGuestUser({ name: 'Guest', email: null, demo: true })).toBe(true);
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

  it('reports remaining native auth readiness work after iOS wiring and lifecycle endpoints', () => {
    const status = getNativeAuthScaffoldStatus();

    expect(status.apple.status).toBe('available');
    expect(status.apple.requiredBeforeEnablement.join(' ')).toMatch(/auth QA/i);
    expect(status.apple.requiredBeforeEnablement.join(' ')).toMatch(/account-management polish/i);
    expect(status.accountLifecycle.status).toBe('available');
    expect(status.accountLifecycle.requiredBeforeEnablement.join(' ')).toMatch(/account deletion verification/i);
  });

  it('rejects unverified native auth payloads rather than creating fake auth success', () => {
    expect(validateNativeAppleAuthRequest({ provider: 'apple' }).ok).toBe(false);
    expect(validateNativeAppleAuthRequest({ provider: 'apple', identityToken: '' }).ok).toBe(false);
    expect(validateNativeAppleAuthRequest({ provider: 'google', identityToken: 'token' }).ok).toBe(false);

    const guarded = buildNativeAppleAuthNotImplementedResponse();
    expect(guarded.ok).toBe(false);
    expect(guarded.code).toBe('NATIVE_APPLE_AUTH_NOT_IMPLEMENTED');
    expect(guarded.error).toMatch(/wired through verified backend sessions/i);
    expect(guarded.error).toMatch(/public-ready auth/i);
  });

  it('keeps guest mode upgrade messaging available while auth remains optional', () => {
    const snapshot = buildAccountFoundationSnapshot({
      id: 'guest-1',
      name: 'Guest',
      email: buildGuestUserEmail('device-session'),
      demo: true,
    });

    expect(snapshot.mode).toBe('guest');
    expect(snapshot.description).toMatch(/without making sign-in mandatory/i);
    expect(snapshot.providers.every((provider) => provider.status === 'planned')).toBe(true);
  });
});
