# Phase 6D Real QA Execution Packet

This packet is the operator-facing handoff for real Mac/Xcode/iPhone QA. It does **not** claim TestFlight readiness. Execute each section on a Mac with Xcode and record evidence before marking anything passed.

## Current Release-Candidate Context

- Source branch for this packet: `feature/phase6d-real-qa-bugfix-intake`
- Required base main: `a08d99199354f59cf56638051dd6eac3506beb2d`
- TestFlight readiness: **not claimed**
- App Store submission readiness: **not claimed**
- Premium/subscriptions: **not started**
- Phase 7: **not started**

## Evidence Rules

For every pass/fail, record:

- Tester name/initials
- Date/time and timezone
- Git commit SHA
- App build/version number
- Device/simulator model
- iOS version
- Backend environment/base URL
- Steps executed
- Expected result
- Actual result
- Evidence location: screenshot, screen recording, Xcode log, CI log, or App Store Connect screenshot
- Bug link if failed

Never record secrets, API keys, provisioning profiles, bearer tokens, Apple identity tokens, token hashes, private Apple ID data, or real user nutrition/profile data.

## Required Accounts and Access

| Access | Required for | Status before QA | Evidence required |
| --- | --- | --- | --- |
| GitHub repo access | Pull latest main and inspect CI | Not verified | Git SHA and local status screenshot/log |
| Apple Developer Program team | Bundle ID, signing, capabilities, device build | Not verified | Team/bundle/capabilities screenshots with private data redacted |
| App Store Connect access | TestFlight metadata/build processing/internal group | Not verified | App/build/internal tester screenshots with private data redacted |
| Apple ID test account | Sign in with Apple smoke test | Not verified | Pass/fail notes only; do not screenshot private Apple ID data |
| Backend production/staging admin access | Verify API environment and account lifecycle | Not verified | Endpoint/base URL confirmation without secrets |

## Required Devices

| Device | Required? | Purpose | Evidence required |
| --- | --- | --- | --- |
| Mac with supported Xcode | Yes | Build/archive/test | Xcode version and build log |
| iPhone simulator | Yes | Fast smoke coverage | Simulator model/iOS version and results |
| Physical iPhone | Yes before readiness claim | Device signing, Keychain/session, real auth UX | Device model/iOS version and results |
| Stable network + offline toggle | Yes | Online/offline smoke tests | Pass/fail notes |

## Required Environment / Config

Before running QA, confirm:

- Backend base URL points to the intended QA/production-like environment.
- Apple Sign in audience/bundle ID matches the iOS app target.
- No production secrets are committed to the repo.
- Any local env files remain local and are not screenshotted or attached.
- Guest mode remains available without login.
- Premium/subscription metadata/capabilities are not enabled for this phase.
- Telemetry SDKs are not added for this phase.

## 1. Pull Latest Main

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short --branch
```

Expected:

- SHA is the latest approved main commit.
- Working tree is clean.

Evidence:

- Terminal log with SHA and clean status.

## 2. Xcode Setup

1. Open `ios/CalorieCompass/CalorieCompass.xcodeproj` in Xcode.
2. Select the `CalorieCompass` scheme.
3. Confirm Xcode version.
4. Confirm the project indexes without errors.
5. Confirm any local config is present without exposing secrets.

Evidence:

- Xcode version.
- Project/scheme screenshot or log.
- Any setup blockers filed with `docs/phase6d-rc-bugfix-intake-template.md`.

## 3. Bundle, Signing, and Capabilities Checks

1. Open target signing settings.
2. Confirm bundle identifier.
3. Confirm selected Apple Developer Team.
4. Confirm signing status is valid.
5. Confirm Sign in with Apple capability is present and matches backend config.
6. Confirm no premium/subscription capability was added for this phase.
7. Confirm no telemetry/crash SDK dependency/capability was added for this phase.

Evidence:

- Redacted signing/capability screenshots.
- Bundle ID/team result in tracker.

## 4. Simulator Build

Run in Xcode, or CLI if available:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build | tee artifacts/phase6d/simulator-build.log
```

Expected:

- Build succeeds.
- App launches on simulator.

Evidence:

- Build log.
- Simulator model/iOS version.
- First-launch screenshot using privacy-safe data.

## 5. Real-Device Build

1. Connect physical iPhone.
2. Select the device in Xcode.
3. Build and run.
4. Confirm first launch.
5. Confirm app remains usable after background/foreground.

Expected:

- Build succeeds on physical iPhone.
- App launches without crash.

Evidence:

- Device model/iOS version.
- Xcode run/build log.
- Privacy-safe first-launch screenshot.

## 6. Backend Production URL Verification

1. Confirm the app points at the intended backend URL.
2. Confirm backend health/session/profile endpoints are reachable where applicable.
3. Confirm no private API keys or tokens are visible in logs.
4. Confirm production/support/privacy URLs if App Store Connect checks are in scope.

Evidence:

- Redacted endpoint/base URL confirmation.
- Pass/fail notes for reachable endpoints.

## 7. Guest Smoke Test

1. Fresh install / clean app state.
2. Launch app without signing in.
3. Confirm Dashboard, Log Meal, History, and Profile are reachable.
4. Confirm sign-in is optional.
5. Log a privacy-safe sample meal as guest.
6. Confirm Dashboard and History update.

Expected:

- Guest mode remains unblocked.
- Meal logging works without login.

Evidence:

- Screenshots/screen recording with safe sample data.
- Pass/fail notes.

## 8. Auth Smoke Test

1. Tap Sign in with Apple.
2. Cancel once and confirm guest mode still works.
3. Complete Sign in with Apple using a test account.
4. Confirm signed-in state appears only after backend session succeeds.
5. Force-close and relaunch.
6. Confirm backend session persistence.

Expected:

- No forced login.
- Backend session, not Apple identity token, drives authenticated app behavior.

Evidence:

- Redacted pass/fail notes.
- No private Apple ID screenshots.

## 9. Account Lifecycle Smoke Test

1. Create guest data.
2. Sign in.
3. Run guest migration.
4. Export account data.
5. Test delete account confirmation cancel path.
6. Execute delete account with a disposable test account only.
7. Confirm local session clears and guest mode returns.

Expected:

- Migration/export/delete are signed-in only.
- Delete is explicit and scoped.
- Guest mode returns after delete.

Evidence:

- Pass/fail notes.
- Redacted screenshots only.
- Bug template for any mismatch.

## 10. Offline / Network Smoke Test

1. Toggle offline/network disabled.
2. Try meal logging, profile load, sign-in backend handoff, migration/export/delete/logout.
3. Restore network and retry.

Expected:

- Safe failure states.
- No silent destructive actions.
- Retry path works when network returns.

Evidence:

- Pass/fail notes.
- Screenshot or recording of failure messages if privacy-safe.

## 11. Accessibility Smoke Test

1. Enable VoiceOver.
2. Navigate Dashboard, Log Meal, History, Profile.
3. Confirm account lifecycle buttons and destructive confirmation are understandable.
4. Increase Dynamic Type to large accessibility sizes.
5. Confirm no critical clipping/overlap blocks core flows.

Evidence:

- Pass/fail notes.
- Screenshots/video if privacy-safe.

## 12. Screenshot Capture

Follow `docs/phase6c-screenshot-workflow.md`.

Required evidence:

- Screenshot set path.
- Device model and iOS version.
- Confirmation each screenshot passed the “Do not upload if…” checklist.
- Product/design approval status.

## 13. Pass/Fail Recording

After execution:

1. Update a copied run-specific QA results doc, not the template itself if results are environment-specific.
2. File each failure with `docs/phase6d-rc-bugfix-intake-template.md`.
3. Update `docs/phase6d-rc-go-no-go-template.md` only with real evidence.
4. Do not mark TestFlight ready until Mac/Xcode/iPhone/upload evidence exists and the release owner approves.

## Current Container Evidence

- Mac/Xcode access in this container: **unavailable**
- iPhone access in this container: **unavailable**
- Real QA evidence captured in this phase: **none**

This is intentional: no QA evidence is faked.
