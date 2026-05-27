# Phase 6C Manual QA Script

This script is for a human running Calorie Compass on a Mac with Xcode and, for final evidence, a real iPhone. Leave results unclaimed until executed.

## 0. Setup Prerequisites

1. Confirm access to the repo.
2. Confirm Apple Developer Team membership.
3. Confirm App Store Connect access if upload/metadata checks are in scope.
4. Confirm target backend environment and base URL.
5. Confirm backend has database persistence enabled.
6. Confirm backend Apple auth audience matches the iOS bundle ID.
7. Confirm no production secrets are stored in the repo or copied into screenshots/logs.
8. Prepare a privacy-safe test account and sample food/profile data.

## 1. Pull Latest Main

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
```

Record the SHA in `docs/phase6b-testflight-execution-evidence.md`.

## 2. Open iOS Project in Xcode

1. Open `ios/CalorieCompass/CalorieCompass.xcodeproj`.
2. Select the `CalorieCompass` scheme.
3. Select an iPhone simulator first.
4. Confirm the project opens without package/index errors.

## 3. Select Bundle ID and Team

1. Open target settings.
2. Confirm bundle ID.
3. Select the correct Apple Developer Team.
4. Confirm signing status has no errors.
5. Record team, bundle ID, and signing status in evidence tracker.

## 4. Check Capabilities

1. Confirm Sign in with Apple capability is enabled for the app identifier.
2. Confirm no premium/subscription capability has been added for Phase 6C.
3. Confirm no telemetry/crash SDK capability or dependency has been added.
4. Confirm backend config matches the bundle ID/audience.

## 5. Run Simulator Build

In Xcode: Product > Build.

Optional CLI:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build | tee ios-build.log
```

Record pass/fail and attach log location.

## 6. Run Real-Device Build

1. Connect physical iPhone.
2. Select device in Xcode.
3. Build and run.
4. Record device model, iOS version, signing status, and first launch result.

Final readiness cannot be claimed without real-device evidence.

## 7. Guest Mode QA

1. Start from clean install/no stored backend session.
2. Launch app.
3. Confirm Dashboard, Log, History, Profile are accessible without login.
4. Confirm Profile says sign-in is optional.
5. Confirm migration/export/delete account actions are not visible to guest users.
6. Record pass/fail.

## 8. Meal Logging QA

1. Log a realistic privacy-safe meal as guest.
2. Confirm review/save flow works.
3. Confirm Dashboard updates.
4. Confirm History shows the meal.
5. Edit/delete if supported and confirm any destructive confirmations.
6. Record pass/fail.

## 9. Dashboard / History / Profile QA

1. Navigate rapidly between tabs.
2. Confirm no crash or stale loading state.
3. Confirm Profile loads guest/account state correctly.
4. Background and foreground the app.
5. Record pass/fail.

## 10. Sign in with Apple QA

1. Tap Continue with Apple.
2. Cancel and confirm guest mode remains available.
3. Complete Apple sign-in with test Apple ID.
4. Confirm app does not show signed-in state until backend returns a Calorie Compass session.
5. Confirm backend bearer session, not Apple identity token, is used for subsequent requests.
6. Record pass/fail.

## 11. Backend Session Persistence QA

1. Sign in successfully.
2. Force-close and relaunch.
3. Confirm signed-in state restores only from backend-session Keychain envelope.
4. Revoke/expire session if possible.
5. Confirm app returns to guest-safe behavior.
6. Record pass/fail.

## 12. Logout / Revocation QA

1. Tap Sign out.
2. Confirm backend logout is called when token exists.
3. Confirm local session clears.
4. Relaunch and confirm guest mode.
5. Record pass/fail.

## 13. Migration / Export / Delete QA

### Migration
1. Create guest meal/profile data.
2. Sign in.
3. Tap Migrate guest data.
4. Confirm loading, success/failure, plausible counts, duplicate-safe retry.

### Export
1. Tap Export account data while signed in.
2. Confirm success state.
3. Confirm no secrets/tokens/full private export appear in logs/screenshots.

### Delete
1. Tap Delete account data.
2. Cancel confirmation and verify no deletion.
3. Confirm again and execute delete.
4. Confirm backend delete/revocation, local session clear, and guest mode return.

Record pass/fail for each.

## 14. Offline / Network Failure QA

1. Toggle offline mode.
2. Try Profile load, sign-in backend handoff, migration, export, delete, logout.
3. Confirm safe loading/failure messages.
4. Confirm no silent destructive side effects.
5. Restore network and retry.
6. Record pass/fail.

## 15. Reinstall / Session Clearing QA

1. Sign in successfully.
2. Delete/reinstall app.
3. Confirm no signed-in state unless a valid backend session remains available.
4. Clear simulator/device content where practical.
5. Confirm clean guest start.
6. Record pass/fail.

## 16. Accessibility / VoiceOver / Dynamic Type QA

1. Enable VoiceOver.
2. Navigate Dashboard, Log, History, Profile.
3. Confirm account action labels/hints and destructive confirmation are understandable.
4. Increase Dynamic Type through large accessibility sizes.
5. Confirm no critical clipping/overlap.
6. Record pass/fail.

## 17. Screenshot Evidence

Follow `docs/phase6c-screenshot-workflow.md`. Do not capture tokens, private Apple ID data, account exports, or sensitive meal/profile details.

## 18. Record Results

1. Update `docs/phase6b-rc-qa-results-template.md` or a copied run-specific file.
2. Update `docs/phase6b-testflight-execution-evidence.md`.
3. Update `docs/phase6c-blockers-register.md` for failures/blockers.
4. Do not mark go/no-go as `Go` until release owner approves.
