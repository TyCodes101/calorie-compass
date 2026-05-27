# Phase 6A TestFlight Release-Candidate QA Checklist

Phase 6A prepares Calorie Compass for real simulator/device TestFlight release-candidate QA. This document is a QA prep artifact, not a TestFlight readiness claim. TestFlight readiness requires dated manual evidence from the intended Apple Developer account, signing setup, backend environment, simulator/device runs, and App Store Connect checks.

## Scope Guardrails

- Guest mode must remain available and unblocked.
- Native Sign in with Apple must rely on backend-issued Calorie Compass sessions only.
- Client-provided identity, Apple display name, Apple email, or client user IDs must not be trusted for account ownership.
- Premium/subscriptions are out of scope.
- Telemetry SDKs are out of scope.
- Secrets/API keys must not be committed.
- Phase 6B upload/submission work is not started by this checklist.

## QA Evidence Header

Record this before each run:

- Date/time:
- Tester:
- Build branch/commit:
- Backend environment/base URL:
- Database environment:
- Apple Developer Team:
- Bundle ID:
- Simulator/device model:
- iOS version:
- App install state: clean install / upgrade / reinstall
- Network state: online / offline / flaky
- Result: go / no-go
- Notes/blockers:

## 1. Launch Smoke Test

- Install and launch the app from a clean state.
- Confirm Dashboard, Log, History, and Profile load without authentication.
- Confirm no crash on first launch, tab switching, or returning from background.
- Confirm backend connection errors are friendly and retry-safe.
- Confirm nutrition/health disclaimer remains present where expected.

## 2. Guest Mode Regression

- Launch without a stored backend session.
- Log a normal meal as a guest.
- Confirm the meal appears in Dashboard and History.
- Edit/delete a guest meal where supported and confirm expected confirmations still appear.
- Confirm Profile messaging says sign-in is optional.
- Confirm account actions for migration/export/delete are not shown to guest users.
- Confirm guest logging still works after cancelling Sign in with Apple.

## 3. Sign in with Apple Flow

- From Profile, tap Continue with Apple.
- Cancel the Apple sheet and confirm guest mode remains available.
- Complete Apple sign-in with a test Apple ID.
- Confirm the app does not mark the user signed in until the backend returns a server-issued Calorie Compass session.
- Confirm the stored session is the backend session token envelope, not the Apple identity token.
- Confirm subsequent backend requests use the backend bearer session.
- Confirm failed Apple token/backend responses keep the user in guest mode with useful failure copy.

## 4. Backend Session Persistence

- Sign in successfully.
- Force-close and relaunch.
- Confirm account state is restored only when a valid backend session exists in Keychain.
- Clear/revoke the backend session where possible and relaunch.
- Confirm stale/expired/revoked sessions do not show signed-in account tools.
- Confirm guest mode remains usable after session loss.

## 5. Logout and Revocation

- From signed-in Profile, tap Sign out.
- Confirm backend logout/revocation is called when a backend token exists.
- Confirm local Keychain session storage is cleared.
- Relaunch and confirm the app returns to guest mode.
- Confirm logging/history remain available in guest mode.
- Confirm repeated sign-out or missing-token cases do not crash.

## 6. Guest Migration

- As a guest, create at least one meal and profile goal data.
- Sign in with Apple.
- Tap Migrate guest data.
- Confirm loading, success, and failure states.
- Confirm migrated counts are plausible.
- Repeat migration and confirm idempotent/duplicate-safe behavior.
- Confirm account Dashboard and History show migrated data.
- Confirm no client-provided user ID is entered or required.

## 7. Export Account Data

- Sign in with Apple.
- Tap Export account data.
- Confirm the action is visible only in signed-in account state.
- Confirm success copy says export data is ready.
- Confirm no backend bearer tokens, Apple identity tokens, token hashes, secrets, or private keys appear in UI/logs.
- Confirm offline/server failure shows failure copy and leaves account data unchanged.
- Note that export share/download polish remains Phase 6B work unless separately completed and verified.

## 8. Delete Account

- Sign in with Apple.
- Tap Delete account data.
- Cancel the destructive confirmation and confirm no delete occurs.
- Reopen and confirm copy scopes deletion to the signed-in account data handled by the backend endpoint.
- Confirm the copy does not claim App Store compliance by itself.
- Confirm deletion only proceeds after explicit destructive confirmation.
- Confirm local session storage clears after successful deletion.
- Confirm app returns to guest mode.
- Confirm unrelated guest/global data is not deleted.
- Reuse the old session if possible and confirm backend safely rejects it.

## 9. Offline and Network Failure States

- Toggle offline mode before launch.
- Repeat Profile load, Sign in with Apple backend handoff, migration, export, delete, and sign-out attempts.
- Confirm each action shows a loading state then a safe failure state.
- Confirm failures do not silently change account data.
- Restore network and confirm retry works where applicable.
- Confirm stale session failures do not force logout unless user signs out or delete succeeds.

## 10. Reinstall and Session Clearing

- Complete sign-in, then delete and reinstall the app.
- Confirm app does not show account state unless a valid Keychain/backend session remains available.
- Manually clear simulator/device app data and Keychain state where practical.
- Confirm clean reinstall starts in guest mode.
- Confirm app remains usable if backend has revoked the old session.

## 11. Accessibility and VoiceOver Pass

- Enable VoiceOver.
- Navigate Dashboard, Log, History, and Profile.
- Confirm Continue with Apple, migrate, export, delete, sign-out, and destructive confirmation controls have clear labels/hints.
- Confirm loading indicators are understandable in context.
- Confirm error/success messages are discoverable.
- Confirm no important text is image-only.

## 12. Dynamic Type Pass

- Test at default, large, and largest accessibility text sizes.
- Confirm Profile account actions do not overlap or clip.
- Confirm Log composer remains usable.
- Confirm Dashboard cards and History rows remain readable.
- Confirm destructive confirmation text remains understandable.

## 13. Keyboard/Input Pass

- Edit profile fields with software keyboard.
- Confirm keyboard does not hide active fields or critical buttons.
- Confirm submit/cancel flows remain reachable.
- Confirm multiline nutrition preferences remain editable.
- Confirm focus returns to a sensible place after save/cancel.

## 14. Crash-Free Navigation Pass

- Rapidly switch tabs while guest.
- Rapidly switch tabs while signed in.
- Background/foreground during loading states.
- Navigate away during migration/export/delete loading states and return.
- Confirm no crash, frozen spinner, or stale signed-in state appears.

## 15. Privacy and Support URL Verification

- Verify production privacy policy URL.
- Verify production support URL.
- Confirm App Store Connect metadata matches these URLs.
- Confirm account deletion support copy matches the actual backend behavior.
- Confirm nutrition/health disclaimer is present in release notes/support docs.
- Confirm no sensitive food/profile/account export data is logged in normal QA paths.

## 16. App Store Account Deletion Verification

- Verify signed-in users can find delete account data from Profile.
- Verify delete flow requires explicit destructive confirmation.
- Verify deletion revokes native sessions and clears local session state.
- Verify scope of deletion is documented: signed-in account data handled by backend endpoint.
- Verify any remaining account deletion requirements outside app behavior are tracked before App Store submission.
- Do not claim App Store compliance until a real-device QA run and final policy/support review are complete.

## 17. Screenshot Capture Checklist

Capture screenshots only after the above flows are stable:

- Guest Dashboard after meal logging.
- Guest Log screen starter/composer state.
- History with realistic logged meals.
- Profile guest mode with optional sign-in messaging.
- Profile signed-in account state, avoiding tokens or private data.
- Account actions visible only when signed in.
- Safe destructive confirmation copy, if needed for internal QA only.
- Avoid screenshots showing Apple ID private data, tokens, account export content, or raw profile details.

## 18. Final Go/No-Go Checklist

Mark each item before a TestFlight readiness claim:

- [ ] Simulator QA pass completed with evidence.
- [ ] Real-device QA pass completed with evidence.
- [ ] Guest mode regression passed.
- [ ] Sign in with Apple backend session flow passed.
- [ ] Logout/revocation passed.
- [ ] Guest migration passed or documented with blocker.
- [ ] Export account data passed or documented with blocker.
- [ ] Delete account passed or documented with blocker.
- [ ] Offline/failure states passed.
- [ ] Reinstall/session clearing passed.
- [ ] VoiceOver pass completed.
- [ ] Dynamic Type pass completed.
- [ ] Keyboard/input pass completed.
- [ ] Crash-free navigation pass completed.
- [ ] Privacy/support URLs verified.
- [ ] App Store account deletion compliance verified.
- [ ] Screenshots captured or explicitly deferred.
- [ ] No secrets/API keys committed.
- [ ] No premium/subscription behavior introduced.
- [ ] No telemetry SDKs introduced.
- [ ] Release owner gives explicit go.

If any box is unchecked, the status is **not ready** and the blocker must be recorded.
