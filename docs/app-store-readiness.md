# App Store Readiness Checklist

Phase 4F tracks App Store/TestFlight asset preparation and manual QA support. This document does not claim the native iOS app is ready to upload.

## Current status
- Phase 3 and Phase 4B through Phase 4D are merged into `main`.
- Phase 4E is merged into `main`.
- Guest mode remains the primary native path.
- Native Sign in with Apple is scaffold-only and disabled.
- Premium/subscriptions are not implemented.
- Interactive simulator and real-device QA have not been completed in this environment.
- TestFlight readiness is not claimed.

## Phase 4F handoff docs
- Use `docs/app-store-connect-metadata.md` for metadata, privacy label, review note, support URL, and account export/delete draft decisions.
- Use `docs/ios-screenshot-plan.md` for the screenshot shot list and screenshot copy guidance.
- Use `docs/ios-manual-qa-runbook.md` for the simulator, real-device, offline, keyboard, accessibility, and guest-mode QA script.
- Use `docs/phase-4e-testflight-readiness.md` for the current project configuration audit.

## Bundle ID, signing, and Xcode setup
- The final production bundle identifier must be set in Xcode before any App Store/TestFlight submission. Current committed placeholder: `com.caloriecompass.ios`.
- Open Xcode, select project root, and verify/change the Bundle Identifier to the intended value for production distribution.
- Choose/confirm the matching App Store Connect app record before archive/upload.
- Under Signing & Capabilities (in Xcode target settings), select the correct Apple Developer Team for all configurations (Debug, Release, Archive).
- Ensure automatic or manual signing is correctly configured and error-free.
- Set version and build numbers intentionally before EACH archive/upload build.
- Archive using the shared `CalorieCompass` scheme on macOS only—simulator builds do not validate archive/signing settings.

## App identity and visual assets / AppIcon checklist
- Replace ALL placeholder AppIcon slots with final, original Calorie Compass artwork, including every required App Store and device size (see `ios/CalorieCompass/Assets.xcassets/AppIcon.appiconset/Contents.json`).
- All icon and accent color assets MUST match the intended production palette; placeholders are not acceptable for public upload.
- The launch screen must render cleanly for all current/target iPhones (test both large and small simulator/device sizes).
- App display name must remain `Calorie Compass` consistently across Info.plist and Xcode project settings.
- No unlicensed, random, or misleading images/assets can be present in the delivered archive/bundle.

## Screenshots and review assets
- Capture current iPhone screenshots for Today, Log, History, meal detail, and Profile.
- Capture at least one session/offline state if it is relevant to review notes.
- Capture small-device screenshots to catch truncation before App Store upload.
- Store final screenshots outside the repo unless intentionally adding review assets.
- Follow `docs/ios-screenshot-plan.md` for recommended scenes and copy. Do not use private meal/profile data in screenshots without tester approval.

## Privacy nutrition labels
Prepare App Store privacy labels for:
- Account/session identifiers.
- Meal logs and nutrition estimates.
- Profile fields such as age, height, weight, goals, and preferences.
- Diagnostics/crash data after telemetry is added.
- Analytics data only if product analytics are enabled.

Do not include secrets, API keys, provider tokens, or private user data in the app bundle, logs, screenshots, or review notes.

## Nutrition and health disclaimer
- Keep user-facing copy clear that nutrition estimates are informational and may be approximate.
- State that Calorie Compass is not medical advice and does not replace a doctor or dietitian.
- Ask users to verify critical nutrition information for allergies, medical diets, and clinical decisions.
- Keep the tone calm and short; avoid alarming legal copy in the primary product flow.

## Data export and deletion
- Web profile export/reset endpoints already exist.
- Native iOS should expose account access, export, and deletion flows before public release.
- Until native account tools exist, review notes and in-app copy should direct users to the web app for account-level actions.
- Confirm deletion behavior covers profile data, meal logs, reusable meals, and related nutrition preferences.

## Analytics and crash logging
- Use `docs/telemetry-plan.md` before adding any SDK.
- Prefer crash reporting first, then privacy-safe product analytics.
- Do not log raw meal descriptions, profile details, nutrition preferences, auth tokens, cookies, or provider responses.

## TestFlight internal tester flow
1. Confirm latest branch CI is green.
2. Archive from Xcode on macOS using the final signing team and bundle id.
3. Upload to App Store Connect.
4. Add internal testers only.
5. Run `docs/ios-testflight-qa.md` against the uploaded build.
6. Record device model, iOS version, build number, tester account/session state, and failed steps.
7. Do not add external testers until auth/session, privacy labels, screenshots, deletion/export expectations, and real-device QA are complete.

## Known blockers before upload
- Final bundle id is not confirmed.
- Apple Developer Team/signing is not finalized.
- App icons are placeholders.
- App Store privacy labels are not complete.
- Screenshots are not captured.
- Support and privacy URLs are not confirmed in App Store Connect.
- Native account sign-in/export/delete flows are incomplete.
- Interactive simulator and real-device QA are still required.
