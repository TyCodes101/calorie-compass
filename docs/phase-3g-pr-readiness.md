# Phase 3G PR Readiness

## Scope
Phase 3G is a stabilization/readiness pass for the native iOS Phase 3 meal-management branch. It does not add new product features or native sign-in.

## CI coverage
GitHub Actions now runs iOS CI on `macos-latest` for `main` and `feature/ios-phase3-meal-management` pushes/PRs:

- Prints `xcodebuild -version`.
- Lists available iOS simulators.
- Selects the first available simulator from `iPhone 16`, `iPhone 15`, then `iPhone 14`.
- Builds `ios/CalorieCompass/CalorieCompass.xcodeproj` with the shared `CalorieCompass` scheme.
- Runs `xcodebuild test` for the same scheme/destination.
- Uploads build logs, test logs, and the `.xcresult` bundle as artifacts.

## Latest verified CI baseline
- Runner: GitHub Actions macOS runner.
- Xcode verified in Phase 3F: Xcode 16.4.
- Simulator verified in Phase 3F: iPhone 16.
- `xcodebuild build`: passed.
- `xcodebuild test`: passed.
- XCTest count after Phase 3F: 15 tests, 0 failures.

## Manual simulator/device QA still required
This Linux VPS cannot perform interactive simulator or physical-device QA. Before TestFlight, someone with Xcode should run this exact script:

1. Open `ios/CalorieCompass/CalorieCompass.xcodeproj`.
2. Select shared scheme `CalorieCompass`.
3. Build and run on a current iPhone simulator.
4. Repeat on a small simulator such as iPhone SE if available.
5. Confirm first launch reaches Today without a crash.
6. Confirm the session banner appears while checking session, then resolves to guest/account/unauthenticated/offline messaging.
7. Visit Today, Log, History, meal detail, and Profile tabs.
8. Log a meal, review items, cancel once, then save once.
9. Confirm Today and History refresh after save.
10. Edit a saved meal and confirm validation blocks invalid values.
11. Delete a saved meal and confirm UI updates only after backend success.
12. Toggle offline/network unavailable and confirm retry/offline messaging remains non-crashy.
13. Test light/dark mode and one larger Dynamic Type size.
14. Capture screenshots for PR/App Store review.

## Known limitations before TestFlight
- Native sign-in is not implemented; session handling is safe/friendly but not a full auth flow.
- Bundle id remains placeholder: `com.caloriecompass.ios`.
- App icon assets are placeholders and need final artwork.
- Apple Developer Team/signing is not finalized in this branch.
- Privacy labels, export/delete native UX, and real-device QA are not complete.
- No interactive simulator screenshots were captured from this Linux environment.

## Recommended PR title
Native iOS Phase 3 meal management and TestFlight readiness

## Recommended PR body
```markdown
## Summary
- Adds native iOS Phase 3 meal management: History list, meal detail, edit/delete confirmation, validation, and refresh notifications.
- Adds native session/auth awareness with safe guest, unauthenticated, expired, and offline states.
- Adds TestFlight readiness docs and CI-based iOS verification.

## Phase 3B–3G highlights
- Native meal management UI and backend PATCH/DELETE wiring.
- Profile/Today/Log/History session error handling.
- Shared Xcode scheme and app metadata/asset placeholders.
- GitHub Actions macOS iOS CI with build/test logs and xcresult artifact.

## Verification
- `npm test`
- `npm run lint`
- `npm run build`
- GitHub Actions iOS CI: `xcodebuild build`
- GitHub Actions iOS CI: `xcodebuild test`

## Known limitations
- Native sign-in is not implemented yet.
- Bundle id/signing/team/app icon/privacy labels require final TestFlight setup.
- Interactive manual simulator/device QA still required before TestFlight.

## Screenshots
_Not captured from Linux VPS. Add simulator/device screenshots before merge if available._
```
