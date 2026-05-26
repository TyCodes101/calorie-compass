# TestFlight Readiness Checklist

Phase 4E prepares the native iOS app for real simulator/device QA and eventual TestFlight. TestFlight readiness is not yet claimed.

See `docs/phase-4e-testflight-readiness.md` for the current Phase 4E audit, simulator checklist, real-device checklist, App Store Connect checklist, and known blockers.

Phase 4F adds manual-readiness handoff docs for App Store metadata, screenshot planning, and QA execution:
- `docs/app-store-connect-metadata.md`
- `docs/ios-screenshot-plan.md`
- `docs/ios-manual-qa-runbook.md`

## Apple / signing
- Apple Developer account active.
- Final Apple Developer Team selected in Xcode Signing & Capabilities for Debug, Release, and Archive.
- Bundle identifier finalized and matched to the App Store Connect app record; current placeholder is `com.caloriecompass.ios`.
- Version and build numbers set intentionally.
- Shared scheme builds for Archive.
- Archive upload tested from Xcode on macOS.

## App identity
- App display name: `Calorie Compass`.
- Replace placeholder AppIcon asset slots with original icon artwork at all required sizes.
- Confirm generated launch screen looks acceptable on small and large devices.
- Capture App Store/TestFlight screenshots for Today, Log, History, meal detail, Profile, and any required session state.
- No copyrighted, random, or externally sourced assets are included without rights.

## Privacy and compliance
- Complete App Store privacy nutrition labels for account/profile data, meal logs, nutrition preferences, and diagnostics if added.
- Keep nutrition estimates disclaimer visible in the product experience and review notes: estimates are informational, may be approximate, and are not medical advice.
- Tell users to verify critical nutrition information and consult a doctor or dietitian for medical nutrition needs.
- Document data export/delete expectations; web profile export/reset endpoints already exist and native UX should expose them before public release.
- Confirm no OpenAI/provider/API keys or secrets are bundled in iOS.

## Backend readiness
- Confirm production backend URL: `https://calorie-compass-chi.vercel.app`.
- Confirm generated Info.plist `CALORIE_COMPASS_BASE_URL` is set to the production backend for upload builds.
- Use scheme environment override only for simulator/local QA; do not commit secrets or private URLs.
- Confirm native requests remain backend-mediated.
- Confirm auth/session plan before external testers; current native app has safe session-expired messaging but not full native sign-in.
- Add crash/error logging before wider TestFlight using `docs/telemetry-plan.md` as the privacy boundary.
- Confirm web account access remains the fallback for sign-in, export, and deletion until native account tools are added.

## CI / PR readiness
- Confirm GitHub Actions `iOS CI` passes on the PR head commit.
- Review `ios-build.log`, `ios-test.log`, and `ios-test-results.xcresult` artifacts for failed runs.
- CI verifies Xcode build/test only; interactive simulator/device QA remains required before TestFlight.
- Use `docs/phase-3g-pr-readiness.md` for the PR summary, manual QA script, and known limitations.
- Use `docs/app-store-readiness.md` for the App Store upload blocker checklist.

## Internal TestFlight steps
- Archive from Xcode on macOS.
- Upload to App Store Connect.
- Add internal testers only first.
- Run `docs/ios-testflight-qa.md` on the uploaded build.
- Capture screenshots/videos for any failed native flows.
- Do not invite external testers until auth/session, privacy labels, and deletion/export UX are confirmed.

## Current blockers
- Final bundle id, signing team, app icon, screenshots, privacy labels, telemetry decision, and manual device QA are still pending.
- Support URL, privacy URL, review notes, and account export/delete decisions still need owner review.
- Native Sign in with Apple is scaffold-only and is not implemented.
- Premium/subscriptions are not implemented.
- TestFlight readiness is not claimed until the blockers above are complete.
