# App Store Readiness Checklist

Phase 4A tracks App Store and TestFlight polish only. This document does not claim the native iOS app is ready to upload.

## Current status
- Phase 3 native meal management is in PR #1 and is not assumed to be merged into `main`.
- iOS CI has verified build and tests on GitHub Actions macOS/Xcode 16.4 for the Phase 3 branch.
- Interactive simulator and real-device QA has not been completed.
- Full native Sign in with Apple is not implemented.

## Phase 3 PR cleanup suggestion
If permissions allow, update PR #1 to:

- Title: `Native iOS Phase 3 meal management and TestFlight readiness`
- Body clearly states CI is verified, manual simulator/device QA is still required, TestFlight readiness is not claimed, native sign-in is not implemented, and signing/icon/privacy work remains pending.

The GitHub integration used for Phase 4A could inspect PR #1 but could not update it because GitHub returned `403 Resource not accessible by integration`.

## Bundle ID and signing
- Choose the final production bundle identifier before upload; current placeholder is `com.caloriecompass.ios`.
- Create or select the matching App Store Connect app record.
- Select the final Apple Developer Team in Xcode Signing & Capabilities.
- Confirm automatic or manual signing works for Debug, Release, Archive, and TestFlight upload.
- Set version and build numbers intentionally before each archive.
- Confirm the shared `CalorieCompass` scheme archives successfully on macOS.

## App identity and visual assets
- Replace placeholder AppIcon slots with original Calorie Compass artwork at every required size.
- Confirm the AccentColor matches the product palette.
- Confirm the launch screen renders cleanly on small and large iPhones.
- Confirm app display name is `Calorie Compass`.
- Confirm no unlicensed or random image assets are included.

## Screenshots and review assets
- Capture current iPhone screenshots for Today, Log, History, meal detail, and Profile.
- Capture at least one session/offline state if it is relevant to review notes.
- Capture small-device screenshots to catch truncation before App Store upload.
- Store final screenshots outside the repo unless intentionally adding review assets.

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
- Native account sign-in/export/delete flows are incomplete.
- Interactive simulator and real-device QA are still required.
