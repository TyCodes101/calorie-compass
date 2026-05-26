# iOS TestFlight QA Checklist

Use this checklist on macOS/Xcode with a simulator and at least one real iPhone before TestFlight submission.

## Setup
- Open `ios/CalorieCompass/CalorieCompass.xcodeproj` in Xcode.
- Select the shared `CalorieCompass` scheme.
- Confirm signing team/bundle id are intentionally configured for the testing account.
- Confirm the build number matches the App Store Connect/TestFlight build under review.
- Build on an iPhone simulator, then on a real device.
- Before manual QA, confirm the latest GitHub Actions `iOS CI` run is green for this branch and download logs/xcresult artifacts if debugging is needed.

## First launch
- App launches without crashes.
- App display name is `Calorie Compass`.
- Launch screen appears cleanly and transitions to the Today tab.
- Tab bar shows Today, Log, History, and Profile.
- Confirm no placeholder icon/artwork is present in the build intended for upload.

## Today tab
- Loading, success, and retry states render without layout jumps.
- Macro progress handles empty data, partial data, and backend errors.
- Pull/refresh works after meal saves, edits, and deletes.

## Log flow
- Send a natural-language meal message.
- Review detected meal items before save.
- Cancel review without saving.
- Save a reviewed meal and confirm History/Today refresh.
- Confirm nutrition disclaimer copy is visible, short, and does not block meal logging.
- Confirm no API keys or provider secrets are present in the app bundle.

## History / meal management
- Saved meals list loads with empty, error, retry, and success states.
- Open meal detail from the list.
- Edit title, meal type, date/time, quantity, calories, and macros.
- Invalid edits show friendly validation and do not send broken PATCH payloads.
- Discard unsaved changes and confirm draft reset.
- Delete a meal only after confirmation; detail view should dismiss cleanly.
- Failed edit/delete should not fake local success.

## Profile
- Profile loads from backend.
- Edit/cancel/save flows work and show errors safely.
- Profile changes do not break Today, Log, or History.
- Confirm the profile note directs users to the web app for account access, export, and deletion while native sign-in is unavailable.

## Offline/session behavior
- Airplane mode: Today, History, Log, and Profile show clear retry/offline messaging.
- Expired/unauthorized session: app shows a sign-in/session-expired message rather than crashing.
- Reconnect network and verify retry recovers.

## Device/layout checks
- Test small device layout, e.g. iPhone SE.
- Test current large iPhone simulator.
- Test light and dark mode.
- Test Dynamic Type at one larger text size.
- Test VoiceOver focus order for tab bar, refresh buttons, meal rows, review remove buttons, and save/delete confirmations.
- Confirm keyboard does not block edit fields.

## Real-device network
- Test on Wi-Fi and cellular/hotspot.
- Confirm production backend URL is reachable.
- Confirm slow network states remain usable.

## Screenshots
- Capture Today, Log, meal review, History, meal detail, Profile, and one session/offline state.
- Confirm screenshots do not include real private meal logs or profile data unless the tester explicitly approves.
- Store screenshots for PR/App Store review handoff.

## CI artifacts
- GitHub Actions uploads `ios-build.log`, `ios-test.log`, and `ios-test-results.xcresult` for each iOS CI run.
- Treat CI as build/test confidence only; it does not replace interactive navigation, layout, keyboard, or real-device QA.

## Phase 3E session/auth QA
- First launch online: session banner should briefly show checking state, then guest/account state or safe unauthenticated messaging.
- First launch offline: app should show an offline session banner and each tab should remain non-crashy with retry messaging.
- Session expired: backend 401/403 should map to a session-expired banner, not raw JSON or a crash.
- Unauthenticated profile/history/meal access: reads and mutations should fail gracefully with clear sign-in/session messaging.
- Retry after network returns: tap retry on the session banner, then retry the affected tab action.
- Save/edit/delete meal while session expired: app must not fake success; local lists update only after backend confirmation.
- Profile edit while session expired: save should remain blocked by backend failure and show a friendly error.
- Guest fallback: if backend reports guest mode, banner should explain that sign-in is not available in this build yet and data is tied to the device session.

## Release blockers to record
- Final bundle id and signing team.
- Final original app icon.
- Privacy nutrition labels.
- Crash/analytics decision from `docs/telemetry-plan.md`.
- Native account/export/delete path or reviewed web fallback.
- Manual simulator and real-device QA results.
