# Phase 5C Auth and Account Lifecycle Contract

This document defines the safe foundation for real native authentication. It does **not** claim full production Sign in with Apple UX, guest-to-account migration, native export/delete, or TestFlight readiness are complete.

## Current guarantees
- Guest mode remains the default working path.
- Native Sign in with Apple never succeeds from an unverified or client-trusted identity.
- Apple identity tokens are verified server-side before any verified Apple identity payload is returned.
- A verified Apple identity can create or link an account and issue a backend-owned native session only when durable database persistence is configured.
- Without `DATABASE_URL`, the native Apple route fails closed after verification and does not create fake or in-memory production sessions.
- Native session tokens are server-generated random values; the database stores only a SHA-256 hash plus expiration/revocation metadata.
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
- Behavior in Phase 5C:
  - Missing/invalid JSON returns `400 INVALID_NATIVE_AUTH_REQUEST`.
  - Missing server audience config returns `503 APPLE_TOKEN_CONFIG_MISSING`.
  - Malformed, expired, invalid issuer, invalid audience, invalid nonce, or invalid signature tokens return `401 APPLE_TOKEN_INVALID`.
  - Valid Apple identity tokens are verified against Apple JWKS/public keys.
  - If durable database persistence is unavailable, the route returns `503 NATIVE_SESSION_PERSISTENCE_UNAVAILABLE` and does not issue a session.
  - If persistence is available, the route creates or links a `UserAuthProvider` row by verified Apple `sub`, creates a `NativeSession`, and returns `200 NATIVE_APPLE_SESSION_ISSUED` with `sessionIssued: true`.
  - The route does **not** migrate guest data yet and does not trust client-supplied name/email.

## Claims verified in Phase 5B
- JWT signature via Apple JWKS/public keys.
- `iss === "https://appleid.apple.com"`.
- `aud` matches server-configured expected audience.
- `sub` exists and is non-empty.
- `exp` is in the future.
- `iat` is not from the future beyond a small clock-skew window.
- If the client sends a nonce, JWT `nonce` must match exactly.

## Account linking model
- Provider identity is stored in `UserAuthProvider`.
- The stable key is `(provider, providerSubject)`, where `provider = "apple"` and `providerSubject` is the verified Apple `sub`.
- First-time Apple users create a new non-demo `User` plus provider link inside the same transaction as session issuance.
- Returning Apple users reuse the existing provider link and user through the unique provider/subject key.
- Verified Apple email is stored on the provider link only when Apple marks the email as verified.
- Client-provided name/email fields are ignored for account creation and linking.

## Native session persistence model
- Native sessions are stored in `NativeSession`.
- The route returns the raw bearer token only once to the native client.
- The database stores `sha256:<digest>`, never the raw token.
- Sessions expire after 30 days.
- Revocation sets `revokedAt`; account data is not deleted on logout.
- `GET /api/session` and current-user helpers can resolve an account from a valid bearer token when future native clients send it in `Authorization: Bearer <token>` or `X-Calorie-Compass-Native-Session`.

## Logout contract
- Route: `POST /api/auth/logout`
- Phase 5C behavior:
  - With no token, returns `200 NATIVE_LOGOUT_GUEST_MODE` as an idempotent guest-safe no-op.
  - With an active backend-issued native token, revokes the matching hashed `NativeSession` and returns `200 NATIVE_SESSION_REVOKED`.
  - With a missing/already-revoked token, returns a guest-safe `200 NATIVE_SESSION_NOT_FOUND`.
  - Logout does not delete meals, profile data, provider links, or guest data.

## Account export/delete/migration
- Existing web profile export/reset paths remain the current fallback.
- Native account export/delete endpoints should require a verified account session before exposing account data or destructive deletion.
- Guest-to-account migration must be transactional and must not rely on client-supplied identity.
- Destructive delete must require confirmation and must define scope: profile, meals, reusable meals, daily logs, nutrition preferences, auth provider links, and native session artifacts.

## Remaining Phase 5D work
- Guest-to-account meal/profile/reusable meal/daily log migration after Apple verification succeeds.
- Verified native export/delete endpoints and iOS affordances.
- Native iOS `AuthenticationServices` Sign in with Apple UX wiring and Keychain storage of the returned backend session token.
- TestFlight auth QA on simulator and real device.
- Session refresh/rotation and revoked Apple credential handling if needed.

## Non-goals for Phase 5C
- No guest-to-account migration yet.
- No full native iOS Sign in with Apple UX yet.
- No forced login.
- No premium/subscription work.
- No telemetry/crash SDKs.
- No TestFlight readiness claim.
