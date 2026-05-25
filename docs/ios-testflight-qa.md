# iOS TestFlight QA Checklist

Use this checklist on macOS/Xcode with a simulator and at least one real iPhone before TestFlight submission.

## Setup
- Open `ios/CalorieCompass/CalorieCompass.xcodeproj` in Xcode.
- Select the shared `CalorieCompass` scheme.
- Confirm signing team/bundle id are intentionally configured for the testing account.
- Build on an iPhone simulator, then on a real device.

## First launch
- App launches without crashes.
- App display name is `Calorie Compass`.
- Launch screen appears cleanly and transitions to the Today tab.
- Tab bar shows Today, Log, History, and Profile.

## Today tab
- Loading, success, and retry states render without layout jumps.
- Macro progress handles empty data, partial data, and backend errors.
- Pull/refresh works after meal saves, edits, and deletes.

## Log flow
- Send a natural-language meal message.
- Review detected meal items before save.
- Cancel review without saving.
- Save a reviewed meal and confirm History/Today refresh.
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

## Offline/session behavior
- Airplane mode: Today, History, Log, and Profile show clear retry/offline messaging.
- Expired/unauthorized session: app shows a sign-in/session-expired message rather than crashing.
- Reconnect network and verify retry recovers.

## Device/layout checks
- Test small device layout, e.g. iPhone SE.
- Test current large iPhone simulator.
- Test light and dark mode.
- Test Dynamic Type at one larger text size.
- Confirm keyboard does not block edit fields.

## Real-device network
- Test on Wi-Fi and cellular/hotspot.
- Confirm production backend URL is reachable.
- Confirm slow network states remain usable.
