# App Store Readiness Notes

Calorie Compass is not App Store-ready as a native iOS app yet. This checklist documents what remains.

## Account and privacy

- Add Sign in with Apple.
- Define account/session handling for native requests.
- Publish a privacy policy.
- Keep OpenAI, database, and nutrition-provider secrets server-side only.
- Ensure account export and delete flows are reachable from iOS.
- Add clear nutrition-estimate disclaimers.

## Native capabilities

- Barcode scanner using the camera.
- Nutrition label OCR.
- Meal photo recognition later, after the chat and barcode flows are stable.
- Push or local meal reminders.
- Offline read states for recent meals/history.

## Reliability and QA

- Xcode project creation.
- Simulator build and launch.
- Physical-device QA for chat input, keyboard, safe areas, and dynamic type.
- Duplicate-save protection with backend idempotency keys.
- Crash/error telemetry.
- App Store screenshots, metadata, age rating, and review notes.

## Product standard before release

- Chat logger feels fast and natural.
- Corrections and save flow match the web app behavior.
- No API keys or debug/provider details leak into the app.
- Review-before-save is obvious and hard to accidentally bypass.
- Barcode and label flows gracefully explain unsupported states until fully shipped.
