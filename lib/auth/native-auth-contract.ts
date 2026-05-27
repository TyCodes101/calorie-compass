export type NativeAuthProvider = 'apple';
export type NativeAuthRouteStatus = 'planned' | 'not_implemented' | 'available';

export type NativeAuthErrorCode =
  | 'INVALID_NATIVE_AUTH_REQUEST'
  | 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED'
  | 'NATIVE_LOGOUT_GUEST_MODE'
  | 'ACCOUNT_EXPORT_NATIVE_NOT_IMPLEMENTED'
  | 'ACCOUNT_DELETION_NATIVE_NOT_IMPLEMENTED'
  | 'GUEST_MIGRATION_NOT_IMPLEMENTED';

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

export type NativeAuthContractResponse = {
  ok: false;
  code: NativeAuthErrorCode;
  error: string;
  requiredBeforeEnablement?: string[];
};

type NativeAppleAuthValidationResult =
  | { ok: true; value: NativeAppleAuthRequest }
  | { ok: false; error: string };

const maxTokenLength = 8192;
const maxOptionalFieldLength = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = maxOptionalFieldLength): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function readOptionalString(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isNonEmptyString(value)) {
    throw new Error(`${field} must be a non-empty string when provided.`);
  }

  return value.trim();
}

export function validateNativeAppleAuthRequest(input: unknown): NativeAppleAuthValidationResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  if (input.provider !== 'apple') {
    return { ok: false, error: 'provider must be apple.' };
  }

  if (!isNonEmptyString(input.identityToken, maxTokenLength)) {
    return { ok: false, error: 'identityToken is required and must be a bounded non-empty string.' };
  }

  try {
    return {
      ok: true,
      value: {
        provider: 'apple',
        identityToken: input.identityToken.trim(),
        authorizationCode: readOptionalString(input.authorizationCode, 'authorizationCode'),
        nonce: readOptionalString(input.nonce, 'nonce'),
        guestSessionId: readOptionalString(input.guestSessionId, 'guestSessionId'),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid native Apple auth request.' };
  }
}

export function getNativeAuthScaffoldStatus() {
  return {
    apple: {
      status: 'not_implemented' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Verify Apple identity token issuer, audience, signature, expiry, and nonce on the backend using Apple public keys/JWKS.',
        'Create or link a User by stable Apple subject identifier without trusting client-supplied email/name alone.',
        'Define and persist backend-issued native session artifacts, refresh, revocation, and logout semantics.',
        'Migrate guest profile, meals, reusable meals, and logs transactionally during upgrade.',
      ],
    },
    accountLifecycle: {
      status: 'planned' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Authenticated account export endpoint that requires a verified account session.',
        'Authenticated account deletion endpoint with confirmation, audit-safe transaction boundaries, and no guest-data surprise deletion.',
        'Logout endpoint that revokes a backend-issued native session token once such tokens exist.',
        'Guest-to-account migration endpoint that links existing guest data only after Apple verification succeeds.',
      ],
    },
  };
}

export function buildNativeAppleAuthNotImplementedResponse(): NativeAuthContractResponse {
  return {
    ok: false,
    code: 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED',
    error: 'Native Sign in with Apple is not available yet. Backend Apple token verification and native session issuance are required before this route can authenticate anyone.',
    requiredBeforeEnablement: getNativeAuthScaffoldStatus().apple.requiredBeforeEnablement,
  };
}
