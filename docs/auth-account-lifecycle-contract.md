# Phase 5E Auth and Account Lifecycle Contract

This document defines the safe foundation for real native authentication, native iOS Sign in with Apple UX wiring, guest-to-account migration, and verified native account lifecycle endpoints. It does **not** claim full production auth polish, App Store account deletion compliance, or TestFlight readiness are complete.

## Current guarantees
- Guest mode remains the default working path.
- Native Sign in with Apple never succeeds from an unverified or client-trusted identity.
- Apple identity tokens are verified server-side before any verified Apple identity payload is returned.
- A verified Apple identity can create or link an account and issue a backend-owned native session only when durable database persistence is configured.
- Without `DATABASE_URL`, the native Apple route fails closed after verification and does not create fake or in-memory production sessions.
- Native session tokens are server-generated random values; the database stores only a SHA-256 hash plus expiration/revocation metadata.
- iOS stores only the backend-issued Calorie Compass session token after the backend returns `NATIVE_APPLE_SESSION_ISSUED`.
- iOS does not mark a user signed in from local placeholder tokens or client-side Apple profile data.
- Guest-to-account migration requires a valid backend-issued native bearer session plus the existing guest session cookie.
- Native account export and delete endpoints require a valid backend-issued native bearer session and never use the first-user fallback.
- Native account export omits native session token hashes and returns only the authenticated account's scoped data.
- Native account delete revokes active native sessions and deletes only the authenticated account's owned profile, meals, reusable meals, daily logs, weight entries, provider links, and account row.
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
- Behavior in Phase 5D:
  - Missing/invalid JSON returns `400 INVALID_NATIVE_AUTH_REQUEST`.
  - Missing server audience config returns `503 APPLE_TOKEN_CONFIG_MISSING`.
  - Malformed, expired, invalid issuer, invalid audience, invalid nonce, or invalid signature tokens return `401 APPLE_TOKEN_INVALID`.
  - Valid Apple identity tokens are verified against Apple JWKS/public keys.
  - If durable database persistence is unavailable, the route returns `503 NATIVE_SESSION_PERSISTENCE_UNAVAILABLE` and does not issue a session.
  - If persistence is available, the route creates or links a `UserAuthProvider` row by verified Apple `sub`, creates a `NativeSession`, and returns `200 NATIVE_APPLE_SESSION_ISSUED` with `sessionIssued: true`.
  - The route does **not** migrate guest data yet and does not trust client-supplied name/email.

## Native iOS Sign in with Apple UX
- The Profile screen uses Apple's native Sign in with Apple authorization sheet.
- iOS sends the Apple identity token to `POST /api/auth/apple/native`.
- iOS sends the authorization code when Apple provides it.
- iOS does not send or trust client-side name/email as account identity.
- iOS omits nonce until a nonce is generated and validated end-to-end.
- On backend success, iOS stores only the backend-issued Calorie Compass session token in Keychain with a local `backend-session-v1:` envelope.
- On backend failure, invalid token, missing server config, or network failure, iOS shows an error and keeps guest mode available.
- Sign out calls the backend logout route with the stored bearer token when one exists, then clears local secure storage.

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
- Current behavior:
  - With no token, returns `200 NATIVE_LOGOUT_GUEST_MODE` as an idempotent guest-safe no-op.
  - With an active backend-issued native token, revokes the matching hashed `NativeSession` and returns `200 NATIVE_SESSION_REVOKED`.
  - With a missing/already-revoked token, returns a guest-safe `200 NATIVE_SESSION_NOT_FOUND`.
  - Logout does not delete meals, profile data, provider links, or guest data.

## Guest-to-account migration
- Route: `POST /api/auth/guest/migrate`
- Required authentication:
  - A valid backend-issued native session in `Authorization: Bearer <token>` or `X-Calorie-Compass-Native-Session`.
  - Durable database persistence via `DATABASE_URL`.
- Guest source:
  - The route reads the existing `cc_guest_session` cookie and derives the guest email server-side.
  - Client-provided user IDs are ignored.
- Migrated data:
  - Profile, meals, reusable meals, daily logs, and weight entries.
  - Food items and reusable meal items move through their parent meal/reusable meal rows.
- Duplicate/conflict behavior:
  - Profile migration is skipped if the account already has a profile.
  - Reusable meals are skipped when moving them would collide with the account's existing `(userId, sourceMealId)` uniqueness.
  - Daily logs are skipped when the account already has a log for the same date.
  - Meals and weight entries are moved by ownership because they do not have account-level unique constraints.
- Response:
  - Returns migrated and skipped counts.
  - Returns a safe skipped/no-op result when no guest session or guest user is available.
  - Guest mode remains available if migration cannot run.

## Native account export
- Route: `GET /api/account/native/export`
- Required authentication:
  - A valid backend-issued native session.
- Behavior:
  - Exports only the authenticated user's account, profile, meals, reusable meals, daily logs, weight entries, provider links, and native session metadata.
  - Does not expose guest/global data.
  - Does not expose raw native session tokens or token hashes.
  - Existing web profile export remains unchanged for current web flows.

## Native account delete
- Route: `DELETE /api/account/native/delete`
- Required authentication:
  - A valid backend-issued native session.
- Behavior:
  - Deletes only the authenticated user's scoped account data.
  - Revokes active native sessions for the authenticated account before deleting the account row.
  - Removes provider links through account deletion.
  - Does not delete unrelated guest/global data.
  - Repeat attempts after deletion are safe because the original native session no longer resolves.
- Product limitation:
  - This endpoint is implemented and tested as a backend contract, but App Store account deletion compliance is not claimed until native UX, confirmation flows, support/privacy URLs, and real-device QA are complete.

## Remaining Phase 5F work
- TestFlight auth QA on simulator and real device.
- Account management UX polish for migration/export/delete.
- App Store account deletion verification, confirmation copy, and support/privacy URL finalization.
- Guest-to-account profile conflict resolution polish if product wants merging instead of conflict skipping.
- Verified native export/delete manual QA.
- Session refresh/rotation and revoked Apple credential handling if needed.
- Premium/subscription planning later, outside this auth foundation.

## Non-goals for Phase 5E
- No claim that native auth is production-complete before manual simulator/device QA.
- No forced login.
- No premium/subscription work.
- No telemetry/crash SDKs.
- No TestFlight readiness claim.
