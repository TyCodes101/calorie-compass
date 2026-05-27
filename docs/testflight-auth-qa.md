# TestFlight Auth QA Checklist

Phase 5F wires native account-management actions to the Phase 5E backend endpoints. This checklist is for simulator and real-device QA before any TestFlight readiness claim. Passing this checklist does not by itself complete signing, App Store privacy metadata, support URLs, screenshots, or final account deletion compliance review.

## Preconditions
- Build from a branch that includes Phase 5E and Phase 5F.
- Configure the native app to point at the intended backend environment.
- Confirm `APPLE_AUTH_AUDIENCE` matches the native bundle identifier used for the QA build.
- Confirm database persistence is enabled for the backend environment.
- Start with a clean install for at least one pass, then repeat with an existing Keychain session for persistence checks.

## Guest Mode Smoke Test
- Launch the app with no stored backend session.
- Confirm Dashboard, Log, History, and Profile load without requiring sign-in.
- Confirm Profile states that sign-in is optional.
- Log a meal as a guest and confirm it appears in Dashboard and History.
- Toggle network offline and confirm guest screens show retry-safe copy without destructive side effects.

## Sign In With Apple Smoke Test
- Tap Continue with Apple from Profile.
- Cancel the Apple sheet and confirm guest mode remains available.
- Complete Apple sign-in with a test Apple ID.
- Confirm the app does not show signed-in state until the backend returns a server-issued Calorie Compass session.
- Confirm Profile refreshes into signed-in account state.
- Confirm requests after sign-in include the backend bearer session, not the Apple identity token.

## Backend Session Persistence
- Force-close and relaunch the app.
- Confirm signed-in state is restored only from the Keychain backend-session envelope.
- Reinstall the app and confirm no signed-in state is shown unless a valid backend session remains available.
- Test an expired or revoked session if possible and confirm Profile asks for sign-in again without blocking guest use.

## Logout And Revocation
- Tap Sign out from the signed-in Profile state.
- Confirm the backend logout endpoint is called when a session exists.
- Confirm local Keychain session storage is cleared.
- Relaunch and confirm the app returns to guest mode.
- Confirm logging and history remain available in guest mode.

## Guest-To-Account Migration
- As a guest, create at least one meal, one favorite/reusable meal if available, and profile goal data.
- Sign in with Apple.
- Tap Migrate guest data.
- Confirm loading, success, and retry-safe failure states.
- Confirm migrated counts are plausible.
- Tap Migrate guest data again and confirm the result is duplicate-safe/idempotent.
- Confirm account Dashboard and History show migrated data.
- Confirm no client-provided user ID is required or entered during migration.

## Export Account Data
- Sign in with Apple and tap Export account data.
- Confirm the action requires the signed-in account state.
- Confirm success copy reports that export data is ready.
- Confirm no token hashes or secrets are visible in the response/logs.
- Confirm offline and server-error states show failure copy and leave account data unchanged.
- Note: share/download file UX is not final in Phase 5F.

## Delete Account Data
- Sign in with Apple and tap Delete account data.
- Cancel the destructive confirmation and confirm no delete occurs.
- Confirm the destructive dialog says the action is scoped to the signed-in account and is not an App Store compliance claim.
- Confirm deletion succeeds only after explicit confirmation.
- Confirm local session storage is cleared after success.
- Confirm the app returns to guest mode.
- Confirm unrelated guest/global data is not deleted.
- Repeat the action with the old session if possible and confirm the backend safely rejects it.

## Offline And Failure Cases
- Run migration, export, delete, and sign out while offline.
- Confirm each action shows a failure message and says nothing else was changed where appropriate.
- Restore network and retry.
- Confirm stale session failures do not force logout unless the user chooses sign out or delete succeeds.

## Accessibility Pass
- Run through Profile with Dynamic Type increased.
- Confirm buttons remain readable and do not overlap.
- Turn on VoiceOver and confirm account action labels and destructive confirmation copy are understandable.
- Confirm loading indicators announce the action context.

## Privacy And App Store Notes
- Verify support URL and privacy URL drafts before TestFlight submission.
- Verify account deletion copy with product/legal review before claiming App Store account deletion compliance.
- Verify nutrition/health disclaimer remains visible in the release documentation.
- Do not include Apple identity tokens, backend bearer tokens, meal text, profile details, or account exports in logs.

## Remaining Before TestFlight Readiness Claim
- Real-device QA evidence with date, device, iOS version, backend environment, and tester initials.
- Final bundle ID, signing team, icon, screenshots, privacy labels, support URL, and privacy URL.
- App Store account deletion compliance review.
- Production monitoring/logging plan that excludes sensitive food/profile data.
