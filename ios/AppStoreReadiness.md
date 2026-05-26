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

- Xcode project must be created locally (not committed for IP or security). See `ios/README.md` for how to set up from source files.
- Simulator build and launch must be performed in a Mac/Xcode environment after local clone.
- Physical-device QA for chat input, keyboard, safe areas, and dynamic type is required and must be recorded with the manual QA pass/fail template.
- Duplicate-save protection with backend idempotency keys is already designed (see docs); verify as part of meal logging regression check.
- Crash/error telemetry is NOT present; do NOT claim, label, or submit analytics or diagnostics until reviewed and implemented.
- App Store screenshots must be captured according to the current official shot plan, with NO placeholders, debug details, or real user data. Metadata, age rating, and review notes must be completed in App Store Connect, referencing the doc checklist here.

## Product standard before release

- Chat logger feels fast and natural.
- Corrections and save flow match the web app behavior.
- No API keys or debug/provider details leak into the app.
- Review-before-save is obvious and hard to accidentally bypass.
- Barcode and label flows gracefully explain unsupported states until fully shipped.
