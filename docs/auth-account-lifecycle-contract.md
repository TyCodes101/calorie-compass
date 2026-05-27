# Phase 5A Auth and Account Lifecycle Contract

This document defines the safe foundation for real native authentication. It does **not** claim production Sign in with Apple is complete.

## Current guarantees
- Guest mode remains the default working path.
- Native Sign in with Apple never succeeds from an unverified client-provided token.
- No Apple secrets, private keys, client secrets, or API keys are stored in the repo.
- No premium/subscription behavior is introduced.
- TestFlight readiness is not claimed.

## Native Sign in with Apple route
- Route: `POST /api/auth/apple/native`
- Required JSON:
  - `provider: "apple"`
  - `identityToken: string`
  - optional `authorizationCode`, `nonce`, `guestSessionId`
- Behavior in Phase 5A:
  - Missing/invalid JSON returns `400 INVALID_NATIVE_AUTH_REQUEST`.
  - Valid-shaped requests still return `501 NATIVE_APPLE_AUTH_NOT_IMPLEMENTED`.
  - The server does **not** trust the token, email, name, or any client-supplied identity yet.

## Required before real authentication can be enabled
- Verify Apple identity token issuer, audience, signature, expiry, and nonce using Apple public keys/JWKS.
- Create/link users by the stable Apple subject identifier only after verification succeeds.
- Issue backend-owned native session artifacts with expiry, refresh, revocation, and secure storage rules.
- Add database tables/fields for auth provider links and native session tokens.
- Transactionally migrate guest data to the verified account only after authentication succeeds.

## Logout contract
- Route: `POST /api/auth/logout`
- Phase 5A behavior:
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

## Non-goals for Phase 5A
- No real Sign in with Apple success path.
- No forced login.
- No premium/subscription work.
- No telemetry/crash SDKs.
- No TestFlight readiness claim.
