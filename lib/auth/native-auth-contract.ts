export type NativeAuthProvider = 'apple';
export type NativeAuthRouteStatus = 'planned' | 'not_implemented' | 'available';

export type NativeAuthErrorCode =
  | 'INVALID_NATIVE_AUTH_REQUEST'
  | 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED'
  | 'APPLE_TOKEN_CONFIG_MISSING'
  | 'APPLE_TOKEN_INVALID'
  | 'APPLE_IDENTITY_VERIFIED_NO_SESSION'
  | 'NATIVE_APPLE_SESSION_ISSUED'
  | 'NATIVE_SESSION_PERSISTENCE_UNAVAILABLE'
  | 'NATIVE_SESSION_PERSISTENCE_FAILED'
  | 'NATIVE_LOGOUT_GUEST_MODE'
  | 'NATIVE_SESSION_REVOKED'
  | 'NATIVE_SESSION_NOT_FOUND'
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

export type VerifiedNativeAppleIdentityResponse = {
  ok: true;
  code: 'APPLE_IDENTITY_VERIFIED_NO_SESSION' | 'NATIVE_APPLE_SESSION_ISSUED';
  sessionIssued: boolean;
  identity: {
    provider: 'apple';
    subject: string;
    audience: string;
    issuer: string;
    expiresAt: number;
    issuedAt: number;
    email?: string;
    emailVerified?: boolean;
  };
  account?: NativeAuthSessionPayload;
  session?: {
    token: string;
    expiresAt: string;
    tokenType: 'Bearer';
  };
  remainingBeforeSession?: string[];
  remainingBeforeFullNativeAuth?: string[];
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
      status: 'planned' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Wire the native iOS Sign in with Apple authorization flow.',
        'Store only the backend-issued native session token in Keychain after a successful server response.',
        'Migrate guest profile, meals, reusable meals, and logs transactionally during upgrade.',
        'Complete simulator and real-device auth QA before treating native Apple sign-in as user-facing ready.',
      ],
    },
    accountLifecycle: {
      status: 'planned' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Authenticated account export endpoint that requires a verified account session.',
        'Authenticated account deletion endpoint with confirmation, audit-safe transaction boundaries, and no guest-data surprise deletion.',
        'Native logout should revoke backend-issued native sessions and clear the local Keychain artifact.',
        'Guest-to-account migration endpoint that links existing guest data only after Apple verification succeeds.',
      ],
    },
  };
}

export function buildNativeAppleAuthNotImplementedResponse(): NativeAuthContractResponse {
  return {
    ok: false,
    code: 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED',
    error: 'Native Sign in with Apple is not available in the iOS app yet. Backend token verification and native session issuance are in place, but iOS authorization wiring and guest migration remain before this can be treated as complete user-facing auth.',
    requiredBeforeEnablement: getNativeAuthScaffoldStatus().apple.requiredBeforeEnablement,
  };
}
