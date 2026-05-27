import { describe, expect, it } from 'vitest';

import { buildAccountFoundationSnapshot, buildGuestUserEmail, getPreferredUserName, isGuestEmail, isGuestUser } from '@/lib/auth-session';
import { buildNativeAppleAuthNotImplementedResponse, getNativeAuthScaffoldStatus, validateNativeAppleAuthRequest } from '@/lib/auth/native-auth-contract';

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

  it('keeps native Apple auth marked as not implemented until backend verification exists', () => {
    const status = getNativeAuthScaffoldStatus();

    expect(status.apple.status).toBe('not_implemented');
    expect(status.apple.requiredBeforeEnablement.join(' ')).toMatch(/Verify Apple identity token/i);
    expect(status.apple.requiredBeforeEnablement.join(' ')).toMatch(/Migrate guest/i);
    expect(status.accountLifecycle.requiredBeforeEnablement.join(' ')).toMatch(/Guest-to-account migration/i);
  });

  it('rejects unverified native auth payloads rather than creating fake auth success', () => {
    expect(validateNativeAppleAuthRequest({ provider: 'apple' }).ok).toBe(false);
    expect(validateNativeAppleAuthRequest({ provider: 'apple', identityToken: '' }).ok).toBe(false);
    expect(validateNativeAppleAuthRequest({ provider: 'google', identityToken: 'token' }).ok).toBe(false);

    const guarded = buildNativeAppleAuthNotImplementedResponse();
    expect(guarded.ok).toBe(false);
    expect(guarded.code).toBe('NATIVE_APPLE_AUTH_NOT_IMPLEMENTED');
    expect(guarded.error).toMatch(/required before this route can authenticate anyone/i);
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
