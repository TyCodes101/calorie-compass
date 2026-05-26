# Telemetry Plan

Phase 4A does not add a crash or analytics SDK. This plan defines the privacy boundaries before implementation.

## Goals
- Detect native crashes and high-impact errors before wider TestFlight.
- Understand whether users can complete core flows: launch, session check, log, save, History load, edit, delete, Profile load.
- Keep telemetry useful without collecting sensitive nutrition or profile content.

## Recommended order
1. Add crash reporting for native iOS, such as Sentry, Firebase Crashlytics, or Apple diagnostics only.
2. Add backend telemetry for API health and mutation outcomes.
3. Add lightweight product analytics only after privacy labels and consent/review language are ready.

## Crash reporting
- Capture app version, build number, device model, iOS version, route/screen name, and crash stack.
- Scrub request bodies, response bodies, auth headers, cookies, profile fields, and meal text.
- Disable screenshot or view hierarchy capture unless explicitly reviewed for privacy.
- Verify crash SDK initialization contains no hard-coded secrets.

## Product analytics events
Use coarse events such as:
- `ios_app_launched`
- `ios_session_check_completed`
- `ios_log_message_sent`
- `ios_meal_review_shown`
- `ios_meal_save_completed`
- `ios_history_loaded`
- `ios_meal_edit_completed`
- `ios_meal_delete_completed`
- `ios_profile_loaded`

Allowed properties:
- App version and build number.
- Platform, iOS version, and device class.
- Screen name.
- Session mode category: guest, account, unauthenticated, expired, offline.
- Success/failure category and typed error category.
- Counts only, such as item count or meal count bucket.

## Do not log
- Raw meal descriptions.
- Food item names.
- Profile name, age, height, weight, goals, preferences, or free text.
- Full API URLs with identifiers when avoidable.
- Meal IDs, user IDs, account IDs, session IDs, cookies, tokens, API keys, or provider responses.
- Nutrition values attached to a specific user or meal.
- Screenshots, keyboard text, or clipboard contents.

## Backend telemetry
- Log endpoint, method, status, latency, deploy version, and typed error category.
- Use request IDs for debugging without exposing user data.
- Keep logs aggregated when possible.
- Apply retention limits before external TestFlight.

## Privacy and release checklist
- Update App Store privacy labels before enabling analytics or crash SDK data collection.
- Document SDK subprocessors in release notes or internal privacy docs.
- Confirm opt-out or consent expectations if analytics goes beyond operational diagnostics.
- Test telemetry in Debug/TestFlight with fake data before shipping.
