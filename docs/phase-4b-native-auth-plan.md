# Phase 4B Native Auth Plan

Phase 4B designs the native iOS auth/session contract for Calorie Compass. This document is intentionally a contract pass first; it does not claim Sign in with Apple, TestFlight readiness, or manual device QA are complete.

## Current backend auth/session behavior

- There is no `app/api/auth/*` route in the repo yet.
- `GET /api/session` returns a lightweight account snapshot plus an optional user object.
- Guest sessions are keyed by the `cc_guest_session` cookie. If the cookie exists, backend helpers resolve or create a Prisma `User` with an email shaped like `<session>@guest.caloriecompass.local` and `demo: true`.
- Without `DATABASE_URL`, backend helpers return a local mock guest-like user so development/test flows still work.
- If no guest cookie exists in a database-backed environment, current-user helpers fall back to the first user in the database. That is not a safe long-term native account contract.
- The Prisma `User` model currently supports `name`, unique optional `email`, and `demo`, but does not model auth providers, Apple subject identifiers, refresh/session tokens, or linked account identities.
- Profile export and reset routes exist under `/api/profile/export` and `/api/profile/reset`, but they currently operate through current-user helpers rather than an authenticated account identity.

## Current iOS session behavior

- iOS calls `GET /api/session` via `BackendService.fetchSession()` on launch.
- `SessionState.swift` maps the response into `guest`, `authenticated`, `unauthenticated`, `expired`, or `offline` states.
- Guest mode is non-blocking and shows a banner explaining that native sign-in is not available in this build.
- `401` and `403` map to expired/session-blocked states; offline transport failures map to an offline state.
- iOS does not currently persist backend credentials, cookies, or bearer tokens intentionally.
- Profile copy directs users to the web app for account access, export, or deletion until native account tools are added.

## Does `/api/session` support guest/account states well enough?

Partially.

`/api/session` is good enough for read-only native state display because it returns `guest` versus `account` and account-readiness copy. It is not enough for real native auth because it does not expose:

- a native login route,
- a logout route,
- a guest-session bootstrap route for iOS,
- a guest-to-account upgrade route,
- token/session expiration metadata,
- current provider identity,
- account deletion/export capability status,
- or a strong guarantee that requests cannot fall back to the first database user.

Before native auth ships, backend current-user resolution must stop using first-user fallback for authenticated production requests.

## What native Sign in with Apple needs

Native Sign in with Apple requires:

1. Apple Developer capability and final bundle identifier.
2. Native `AuthenticationServices` flow that returns an identity token and authorization code.
3. Backend verification of the Apple identity token against Apple public keys/audience/issuer.
4. Server-side account creation or lookup by Apple `sub`.
5. Guest-to-account data migration/linking.
6. A durable session returned to iOS after backend verification.
7. Secure local storage of only the minimum session artifact needed for future API calls.
8. Logout and revoked-session handling.
9. Export/delete UX that works for native account users.

Do not fake Apple auth by accepting client-provided names/emails without backend token verification.

## Backend routes needed

Recommended minimal route set:

- `POST /api/auth/apple/native`
  - Input: Apple identity token, authorization code if needed, nonce if used, optional guest session id.
  - Server verifies Apple token and links/creates account.
  - Output: typed session payload plus secure session cookie or short-lived token contract.
- `POST /api/auth/guest`
  - Creates/returns a guest session for native clients if cookie-based sessions are retained.
- `POST /api/auth/logout`
  - Invalidates current server session or clears guest/account session cookie.
- `POST /api/auth/upgrade-guest`
  - May be combined with Apple native route; migrates guest meals/profile/reusable meals to account.
- `GET /api/session`
  - Extend with provider, capabilities, expiration, and account action availability.
- `DELETE /api/account`
  - Eventually delete account data, or expose a clear handoff if deletion remains web-only.

## iOS screens/states needed

- Account status section in Profile showing current mode: guest, account, unavailable, expired, or offline.
- Native Auth screen or sheet with Sign in with Apple entry point once backend verification exists.
- Disabled/coming-soon Sign in with Apple state until backend contract and Apple capability are ready.
- Sign out confirmation and post-sign-out state.
- Guest-to-account upgrade explanation before migration.
- Export/delete account entry points before public release; web fallback is acceptable only during internal readiness.
- Clear error states for cancelled Apple auth, invalid server verification, expired session, offline, and migration failure.

## Secure storage approach

Preferred approach:

- Use Keychain for any bearer-style native session token.
- Prefer server-managed `HttpOnly`, `Secure`, `SameSite` cookies if the backend can support native cookie persistence reliably through `URLSession`.
- Do not store Apple identity tokens, authorization codes, provider refresh tokens, API keys, or raw provider responses in UserDefaults.
- UserDefaults may store non-sensitive UI hints only, such as last known session mode.

## Cookies or tokens?

Recommendation: pick one explicit contract before implementation.

- Cookies align with the existing web/Next.js model and reduce token exposure if `HttpOnly` server cookies work cleanly with native `URLSession`.
- Bearer tokens are more explicit for native clients and easier to store in Keychain, but require a new issue/refresh/revocation contract.

For the first production-ready slice, server-managed secure cookies are preferable if they can be tested end-to-end with native `URLSession`. If not, use short-lived access tokens plus refresh tokens stored in Keychain, with rotation and logout invalidation.

## Guest-to-account upgrade behavior

- Guest mode must remain usable without sign-in.
- Upgrade should preserve profile, meals, reusable meals, daily logs, and preferences.
- If an Apple account already exists, backend should define whether to merge, keep separate, or ask the user before replacing anything.
- Migration should be transactional where possible.
- The user should see a clear success state and should not lose guest data on auth cancellation or verification failure.

## Sign out behavior

- Account sign-out should invalidate server session and remove native credentials/cookies.
- Sign-out should not delete account data.
- After sign-out, the app can either create/return to guest mode or show unauthenticated state with a clear continue-as-guest option.
- Local UI caches should refresh after sign-out so prior account data is not shown as current.

## Delete account/data expectations

Before external testing/public release:

- Native UX should expose export and delete/reset paths clearly.
- Delete account should cover profile, meal logs, reusable meals, daily logs, weight entries, and related nutrition preferences.
- Guest reset/delete should be distinct from permanent account deletion.
- Destructive actions need confirmation and a recovery-aware copy boundary.

## Privacy/security risks

- First-user fallback can leak or mutate the wrong account in production-like native contexts.
- Hard-coded secrets or provider credentials in iOS would be a release blocker.
- Logging raw meal text, profile data, Apple tokens, cookies, user IDs, or provider responses would violate the telemetry plan.
- Guest-to-account migration can duplicate, overwrite, or orphan data if not transactional.
- Session refresh and logout must be tested for stale UI and cached data leakage.
- Apple credential revocation should be handled eventually, even if not in the first slice.

## Implementation phases

### 4B-0: Contract and safe UI scaffolding
- Document backend/iOS auth contract.
- Decode provider readiness from `/api/session` in iOS.
- Show account status and disabled Sign in with Apple readiness copy.
- Do not implement real Apple auth yet.

### 4B-1: Backend session hardening
- Remove unsafe first-user fallback from production authenticated flows.
- Add explicit guest bootstrap/session route for native if cookies remain the contract.
- Extend `/api/session` with capabilities and provider metadata.
- Add tests for guest, unauthenticated, expired, and account states.

### 4B-2: Native auth shell
- Add Auth screen/sheet and Sign in with Apple button only when backend route exists.
- Add Keychain/cookie storage strategy.
- Add logout scaffolding.

### 4B-3: Apple verification and account linking
- Implement backend Apple token verification.
- Create/link account by Apple subject.
- Add guest migration transaction.
- Add server tests for verification and migration edge cases.

### 4B-4: Account management readiness
- Native export/delete/reset UX.
- Privacy labels updated.
- Manual simulator/device QA.
- Internal TestFlight-only validation.

## Tests needed

Backend:
- `/api/session` returns correct mode/capabilities for guest, account, and unauthenticated states.
- Guest bootstrap creates safe guest session without first-user fallback.
- Apple auth rejects invalid tokens and accepts verified tokens only.
- Guest-to-account migration preserves all owned data.
- Logout invalidates session without deleting data.
- Delete/export are scoped to the current user.

Native/iOS:
- Session decoding handles providers/capabilities being present or absent.
- Guest and unauthenticated banners remain non-crashing and clear.
- Disabled Sign in with Apple copy is visible until backend is ready.
- Expired/offline states block mutations as intended.
- Logout/refresh clears stale account status once implemented.

Release/manual QA:
- Fresh install guest mode.
- Upgrade guest to Apple account.
- Existing Apple account sign-in.
- Sign out and continue as guest.
- Delete/export handoff.
- Offline and expired-session handling.

## What should NOT be implemented yet

- Do not implement fake Sign in with Apple.
- Do not add Apple secrets, private keys, API keys, or provider credentials to iOS.
- Do not ship a native auth button that appears functional before backend verification exists.
- Do not remove or block guest mode.
- Do not change production web auth/session behavior without a separate backend-auth hardening pass.
- Do not start barcode, OCR, photo logging, HealthKit, widgets, or Live Activities in Phase 4B.
