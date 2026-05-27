# Phase 5B Auth and Account Lifecycle Contract

This document defines the safe foundation for real native authentication. It does **not** claim production Sign in with Apple, native account sessions, or TestFlight readiness are complete.

## Current guarantees
- Guest mode remains the default working path.
- Native Sign in with Apple never succeeds from an unverified or client-trusted identity.
- Apple identity tokens are verified server-side before any verified Apple identity payload is returned.
- A verified Apple identity does **not** create a production session yet.
- No Apple secrets, private keys, client secrets, API keys, telemetry SDKs, premium code, or subscription behavior are stored/introduced in the repo.
- TestFlight readiness is not claimed.

## Native Sign in with Apple route
- Route: `POST /api/auth/apple/native`
- Required JSON:
  - `provider: "apple"`
  - `identityToken: string`
  - optional `authorizationCode`, `nonce`, `guestSessionId`
- Server config required:
  - `APPLE_AUTH_AUDIENCE` preferred, or `APPLE_CLIENT_ID`, or `NEXT_PUBLIC_APPLE_BUNDLE_ID`
  - This value must match the expected Apple token audience/client id/bundle identifier for the native app.
- Behavior in Phase 5B:
  - Missing/invalid JSON returns `400 INVALID_NATIVE_AUTH_REQUEST`.
  - Missing server audience config returns `503 APPLE_TOKEN_CONFIG_MISSING`.
  - Malformed, expired, invalid issuer, invalid audience, invalid nonce, or invalid signature tokens return `401 APPLE_TOKEN_INVALID`.
  - Valid Apple identity tokens are verified against Apple JWKS/public keys and return `200 APPLE_IDENTITY_VERIFIED_NO_SESSION` with `sessionIssued: false`.
  - The route does **not** create users, link accounts, migrate guest data, issue sessions, or trust client-supplied name/email.

## Claims verified in Phase 5B
- JWT signature via Apple JWKS/public keys.
- `iss === "https://appleid.apple.com"`.
- `aud` matches server-configured expected audience.
- `sub` exists and is non-empty.
- `exp` is in the future.
- `iat` is not from the future beyond a small clock-skew window.
- If the client sends a nonce, JWT `nonce` must match exactly.

## Required before real account sessions can be enabled (Phase 5C+)
- Create/link users by the stable verified Apple `sub` only after verification succeeds.
- Add database tables/fields for auth provider links and backend-issued native session tokens.
- Issue backend-owned native session artifacts with expiry, refresh, revocation, and secure storage rules.
- Transactionally migrate guest profile, meals, reusable meals, daily logs, and preferences after Apple verification succeeds.
- Define account/session behavior for logout, session refresh, and revoked Apple credentials.

## Logout contract
- Route: `POST /api/auth/logout`
- Phase 5B behavior:
  - Returns `200` as an idempotent guest-safe no-op.
  - Does not claim to revoke a production account session because none exists yet.
- Future behavior:
  - Revoke backend-issued native session token.
  - Clear server-side refresh/session state.
  - Preserve or safely detach guest state according to migration rules.

## Account export/delete/migration
- Existing web profile export/reset paths remain the current fallback.
- Native account export/delete endpoints should require a verified account session before exposing account data or destructive deletion.
- Guest-to-account migration must be transactional and must not rely on client-supplied identity.
- Destructive delete must require confirmation and must define scope: profile, meals, reusable meals, daily logs, nutrition preferences, auth provider links, and native session artifacts.

## Non-goals for Phase 5B
- No production account/session issuance.
- No native user linking or guest migration.
- No forced login.
- No premium/subscription work.
- No telemetry/crash SDKs.
- No TestFlight readiness claim.
