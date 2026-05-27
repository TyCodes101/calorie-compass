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
      status: 'available' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Complete account-management polish for signed-in native users.',
        'Complete simulator and real-device auth QA before treating native Apple sign-in as public-ready.',
        'Finalize production Apple audience, bundle id, signing, support, and privacy configuration.',
      ],
    },
    accountLifecycle: {
      status: 'available' satisfies NativeAuthRouteStatus,
      requiredBeforeEnablement: [
        'Native confirmation UX for account export, account deletion, and guest migration status.',
        'App Store account deletion verification with final support and privacy URLs.',
        'Simulator and real-device QA for migration, export, delete, logout, and failed auth states.',
      ],
    },
  };
}

export function buildNativeAppleAuthNotImplementedResponse(): NativeAuthContractResponse {
  return {
    ok: false,
    code: 'NATIVE_APPLE_AUTH_NOT_IMPLEMENTED',
    error: 'Native Sign in with Apple is wired through verified backend sessions, but this guarded response remains for clients using an older disabled entry point. TestFlight auth QA and account-management polish remain before public-ready auth is claimed.',
    requiredBeforeEnablement: getNativeAuthScaffoldStatus().apple.requiredBeforeEnablement,
  };
}
