# iOS Manual QA Runbook

Use this runbook on macOS with Xcode before any real TestFlight submission. Manual simulator and real-device QA have not been completed in this environment.

## Preconditions
- Checkout the target branch or release commit.
- Confirm GitHub Actions `iOS CI` is green for the commit under test.
- Open `ios/CalorieCompass/CalorieCompass.xcodeproj`.
- Select the shared `CalorieCompass` scheme.
- Confirm `CALORIE_COMPASS_BASE_URL` points to the intended backend.
- Confirm the bundle identifier, signing team, version, and build number are intentional for the run.
- Record tester name, date, device/simulator, iOS version, app commit, build number, backend URL, and network type.

## Simulator smoke test
- Build and launch on a current iPhone simulator.
- Build and launch on a small iPhone simulator if available.
- Confirm launch screen, tab bar, Today, Log, History, and Profile appear without clipping.
- Confirm guest/session banner behavior is clear and non-blocking.
- Navigate through each tab twice to catch stale navigation or unexpected reload loops.
- Force quit and relaunch; confirm the app still opens to a usable state.

## Real-device smoke test
- Build and run on a physical iPhone using the intended signing team.
- Test on Wi-Fi.
- Test on cellular or hotspot if available.
- Lock/unlock the device while the app is open.
- Background and foreground the app from Today, Log, History, and Profile.
- Confirm safe-area spacing, tab bar, sheets, alerts, and destructive confirmations are tappable.

## Guest mode regression checks
- Confirm logging a meal does not require native sign-in.
- Confirm Dashboard, Log, History, and Profile remain reachable in guest mode.
- Confirm disabled Apple sign-in copy says coming soon and does not start an auth flow.
- Confirm account/export/delete copy points to the web fallback while native account tools are unavailable.
- Confirm meal save, edit, and delete do not fake success when the backend fails.

## Logging and meal flow
- Type a natural-language meal.
- Send it once and confirm duplicate-submit guards prevent repeated sends.
- Review parsed items.
- Remove an item and confirm totals update.
- Save the meal and confirm Today and History refresh.
- Cancel a review and confirm no meal is saved.
- Try an empty meal input and confirm it is ignored safely.

## History and edit/delete
- Load meal history with existing meals.
- Open a meal detail screen.
- Edit meal type, date/time, quantity, calories, and macros.
- Try invalid values and confirm validation blocks save.
- Save valid changes and confirm the detail/list refreshes.
- Delete a meal only after confirmation and confirm navigation returns safely.

## Profile
- Load profile.
- Edit text and numeric fields.
- Confirm numeric keyboards appear for numeric fields.
- Cancel changes and confirm values revert.
- Save changes and confirm success or clear failure copy.
- Confirm profile failures do not block Today, Log, or History.

## Offline and network tests
- Start online, load Today, History, and Profile.
- Enable airplane mode or disable network.
- Confirm Today, Log, History, and Profile show clear offline/retry behavior.
- Attempt save/edit/delete while offline and confirm no fake success.
- Restore network and retry affected actions.
- Test a slow connection if available.

## Keyboard and input tests
- Confirm Log input remains visible while typing.
- Confirm return/on-submit behavior does not create duplicate submissions.
- Confirm Profile edit fields are not hidden by keyboard.
- Confirm sheet dismissal and Cancel buttons work after keyboard interaction.
- Confirm Dynamic Type larger text does not overlap key actions.

## Accessibility checks
- Enable VoiceOver.
- Confirm tab order reaches Today, Log, History, and Profile.
- Confirm retry buttons, meal rows, review remove buttons, save buttons, cancel buttons, and delete confirmations have understandable labels.
- Confirm guest/account state is announced without implying sign-in is active.
- Test one larger Dynamic Type size.
- Test light mode and dark mode.

## Failure capture
- Record exact steps, expected result, actual result, device, iOS version, build number, network state, backend URL, and screenshots or screen recording.
- Download `ios-build.log`, `ios-test.log`, and `ios-test-results.xcresult` if CI failed for the same commit.
- Do not include private meal logs or profile data in shared QA artifacts without tester approval.

---

## Manual QA Pass/Fail Template

> **This template must be completed for every attempted TestFlight or PR QA pass.**

### Header
- Tester name:
- Date/time of run:
- Branch/commit:
- Device/simulator, iOS version:
- Build number:
- Backend URL:
- Network (Wi-Fi, cellular, offline):

### Checklist summary
- Simulator smoke test: PASS / FAIL (comments:)
- Real-device smoke test: PASS / FAIL (comments:)
- Guest mode: PASS / FAIL (comments:)
- Log/meal flow: PASS / FAIL (comments:)
- History/edit/delete: PASS / FAIL (comments:)
- Profile: PASS / FAIL (comments:)
- Offline/network: PASS / FAIL (comments:)
- Keyboard/input: PASS / FAIL (comments:)
- Accessibility: PASS / FAIL (comments:)
- Screenshots/capture (if relevant): PASS / FAIL (comments:)
- Any unexpected crashes, errors, or UI bugs:

### Outcome
- READY for TestFlight: YES / NO (must be NO if any critical item above is FAIL)
- Blockers/notes:

---

## Exit criteria before TestFlight claim
- Simulator smoke test completed.
- Real-device smoke test completed.
- Guest mode regression checks completed.
- Offline/network checks completed.
- Keyboard/input checks completed.
- Accessibility checks completed.
- Known blockers are either fixed or documented as accepted for internal-only testing.
