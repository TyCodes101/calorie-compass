export type NativeAuthProvider = 'apple';
export type NativeAuthRouteStatus = 'planned' | 'not_implemented' | 'available';

export type NativeAppleAuthRequest = {
  provider: NativeAuthProvider;
  identityToken: string;
  authorizationCode?: string;
  nonce?: string;
  guestSessionId?: string;
};

export type NativeAuthSessionPayload = {
  mode: 'guest' | 'account';
  userId: string;
  provider?: NativeAuthProvider;
  canUpgradeGuest: boolean;
};

export function getNativeAuthScaffoldStatus() {
  return {
    apple: {
      status: 'not_implemented' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Verify Apple identity token issuer, audience, signature, expiry, and nonce on the backend.',
        'Create or link a User by stable Apple subject identifier without trusting client-supplied email/name alone.',
        'Define native session issuance, refresh, revocation, and logout semantics.',
        'Migrate guest profile, meals, reusable meals, and logs transactionally during upgrade.',
      ],
    },
  };
}
