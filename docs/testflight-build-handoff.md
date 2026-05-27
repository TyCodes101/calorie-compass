# TestFlight Build Handoff Checklist

This handoff documents the Mac/Xcode steps needed to create a TestFlight candidate. It requires manual Apple Developer access and does not claim TestFlight readiness or App Store submission readiness.

## Required Manual Access

The person performing this handoff needs:

- Apple Developer Program access for the target team.
- App Store Connect access for Calorie Compass.
- Permission to manage identifiers, signing, capabilities, and TestFlight builds.
- Access to production/staging backend configuration values.
- Access to final app icon/source assets.

Do not commit Apple private keys, API keys, client secrets, provisioning profiles, or local signing credentials to the repo.

## 1. Open the iOS Project

1. On a Mac with the intended Xcode version installed, clone or pull the repo.
2. Check out the release-candidate commit.
3. Open:
   - `ios/CalorieCompass/CalorieCompass.xcodeproj`
4. Select the `CalorieCompass` scheme.
5. Select an iOS Simulator first, then a real device for device QA.

## 2. Confirm Bundle ID

1. In Xcode, select the `CalorieCompass` project.
2. Select the app target.
3. Open **Signing & Capabilities**.
4. Confirm the bundle identifier matches the Apple Sign in audience configured on the backend.
5. Confirm the backend environment has the matching Apple audience value configured.
6. If the bundle ID changes, update Apple Developer identifiers and backend config before QA.

Manual Apple Developer access required: bundle identifier registration and App ID changes.

## 3. Select Apple Developer Team

1. In **Signing & Capabilities**, choose the correct Apple Developer Team.
2. Confirm signing mode is appropriate for the team workflow.
3. Confirm local Xcode can create/use a development provisioning profile.
4. Resolve signing errors in Apple Developer/Xcode, not by committing secrets.

Manual Apple Developer access required: team membership and certificate/provisioning permissions.

## 4. Verify Capabilities

Confirm capabilities are present and valid for the selected bundle ID:

- Sign in with Apple.
- Any required app group/keychain sharing setting if later introduced.
- No telemetry/crash SDK capability unless separately approved.
- No premium/subscription capability work in Phase 6A.

If capabilities differ between Debug and Release, record the difference in QA notes.

## 5. Replace Placeholder App Icons

1. Open `ios/CalorieCompass/Assets.xcassets`.
2. Confirm all AppIcon slots are filled with final production-ready assets.
3. Verify icon appearance in simulator and on a real device.
4. Confirm no placeholder/default icon remains.

Manual design/product approval required before release-candidate signoff.

## 6. Configure Backend Environment

Before simulator/device QA:

- Confirm native app base URL points at the intended backend environment.
- Confirm `APPLE_AUTH_AUDIENCE` matches the iOS bundle ID/client identifier.
- Confirm database persistence is enabled.
- Confirm account migration/export/delete endpoints are deployed.
- Confirm no test secrets are embedded in the iOS app.

## 7. Run Simulator Build and Tests

From Xcode:

1. Select a supported iPhone simulator.
2. Build the `CalorieCompass` scheme.
3. Run the app.
4. Run available unit tests from the Test navigator if configured.
5. Execute `docs/phase6a-testflight-rc-qa.md` simulator sections.

CLI option on Mac:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build | tee ios-build.log
```

If tests are configured for the scheme:

```bash
set -o pipefail
xcodebuild \
  -project ios/CalorieCompass/CalorieCompass.xcodeproj \
  -scheme CalorieCompass \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  test | tee ios-test.log
```

## 8. Run Real-Device QA

1. Connect a physical iPhone.
2. Select the real device in Xcode.
3. Build and run.
4. Complete at least:
   - Launch smoke test.
   - Guest mode logging.
   - Sign in with Apple.
   - Backend session persistence after force-close/relaunch.
   - Logout/revocation.
   - Guest migration.
   - Export account data.
   - Delete account data with destructive confirmation.
   - Offline/failure states.
   - VoiceOver and Dynamic Type spot checks.
5. Record device model, iOS version, tester, date, and backend environment.

Manual Apple Developer access may be required for device registration/signing.

## 9. Archive the Build

Only archive after simulator and real-device QA have no release-blocking issues.

1. In Xcode, select **Any iOS Device (arm64)** or a generic iOS device destination.
2. Choose **Product > Archive**.
3. Wait for Organizer to open.
4. Validate the archive.
5. Record archive version/build number.

Do not proceed if signing, icon, capability, privacy URL, or account deletion requirements are unresolved.

## 10. Upload to App Store Connect/TestFlight

This starts Phase 6B-style distribution work and requires explicit approval.

1. In Organizer, select the archive.
2. Choose **Distribute App**.
3. Select App Store Connect/TestFlight distribution path.
4. Follow signing/upload prompts.
5. Confirm upload appears in App Store Connect.
6. Add internal testers only after release owner approval.
7. Record build number and processing status.

Manual App Store Connect access required. Do not claim App Store submission readiness from upload alone.

## 11. Final Handoff Notes

Before asking for release approval, provide:

- Commit SHA.
- Build number/version.
- Backend environment.
- Simulator QA evidence.
- Real-device QA evidence.
- Known blockers/deferrals.
- Privacy/support URL verification.
- Account deletion verification notes.
- Confirmation that guest mode remains available.
- Confirmation no premium/subscription work was introduced.
- Confirmation no secrets/API keys were committed.
- Confirmation no telemetry SDKs were added.
