# App Store Connect Metadata Draft

Phase 4F prepares App Store/TestFlight copy and review-support material. This document is a draft for App Store Connect entry; it does not claim the native iOS app is ready for TestFlight or App Store submission.

## App identity
- App name: `Calorie Compass`
- Current bundle identifier placeholder: `com.caloriecompass.ios`
- Current display name: `Calorie Compass`
- Current version/build placeholders: `1.0` / `1`
- Primary native mode: guest meal logging and meal history
- Account state: native Sign in with Apple is scaffold-only and disabled
- Monetization state: premium/subscriptions are not implemented

## Subtitle ideas
- `AI meal logging made clear`
- `Track meals with confidence`
- `Nutrition estimates, simplified`

Use one subtitle only after screenshots and final positioning are reviewed in App Store Connect.

## Short description draft
Calorie Compass helps you log meals, review nutrition estimates, and track daily progress with a simple native iOS experience.

## Full app description draft
Calorie Compass is a meal logging and nutrition tracking companion built around a conversational logger, review-before-save meal details, daily progress, meal history, and profile goals.

Use the app to describe a meal in natural language, review the estimated nutrition, save the meal, and keep an eye on daily calories and macros. Meal history and profile tools help you review what you logged and keep goals visible.

Nutrition values are estimates for general information. Calorie Compass is not medical advice and does not replace a doctor, dietitian, or clinical nutrition plan. Verify critical nutrition information for allergies, medical diets, and health decisions.

Native account sign-in is not available in this build. Guest mode remains the primary native path, and web account tools remain the fallback for account access, export, or deletion until native account flows are complete.

## Keywords draft
calorie tracker, meal log, nutrition, macros, protein, food diary, diet, meal history, health, fitness

Keep keywords within App Store Connect limits and remove any terms that imply medical, diagnostic, or subscription features that are not present.

## Promotional text draft
Log meals conversationally, review nutrition estimates, and track daily progress from a native iOS app.

## Review notes draft
This build is intended for internal TestFlight review and manual QA preparation.

- Native Sign in with Apple is not implemented in this build.
- Premium/subscriptions are not implemented.
- Guest mode remains the primary native path.
- The app talks only to the Calorie Compass backend at the configured base URL.
- No API keys, provider secrets, Apple private keys, telemetry SDKs, or crash-reporting SDKs are bundled in the iOS app.
- Nutrition values are estimates for informational use and are not medical advice.
- Account export/deletion is available through the web app today; native account/export/delete UX remains a blocker before public release.

## Support and Privacy URL Checklist/Template
- Support and privacy URLs must be present, HTTPS, and reachable without login before App Store/TestFlight submission.
- Confirm a public support URL (e.g. https://yourdomain/support) is registered in App Store Connect.
- Confirm a public privacy policy URL (e.g. https://yourdomain/privacy) is registered and covers all current features/uses.
- Support page must clearly explain how users can:
    - Get help with meal logs, app bugs, or feature issues
    - Request account access/export/deletion (provide direct link/fallback to web if native tools are incomplete)
- Privacy policy must describe data collected (meal logs, nutrition estimates, profile, diagnostics/analytics if present) and state NO diagnostics/analytics are active until explicitly added and reviewed.
- Do not use private, non-production, or preview URLs anywhere in App Store Connect.

## Privacy Nutrition Label Checklist (App Store Connect)
- You must review and complete privacy labels for ALL the following BEFORE public upload:
   - Meal logs and any raw meal/food descriptions.
   - Nutrition estimates, meal history, and item breakdowns.
   - Profile fields (name, age, height, weight, calorie/protein/goal data, and nutrition preferences).
   - Any account/session identifiers linked to backend, analytics, or support systems.
   - Diagnostics/crash data (only if/when a real crash-reporting implementation lands).
   - Analytics data (only if/when actual privacy-audited analytics are present; do NOT claim analytics until shipped and reviewed).

- **Explicit rule:** Do NOT claim telemetry, analytics, or crash-reporting unless a real, production implementation is in the binary and fully audited. These may remain "not collected" until reviewed and enabled.
- Never submit or label any field as using API keys, provider secrets, database credentials, or private tokens—such data is server-side only.
- Do not log or export real meal/profile/user data for diagnostics or screenshots unless the tester has given explicit approval and all artifacts remain private.

## Account export and deletion decision checklist
- Decide whether native iOS must expose account export/delete before internal TestFlight or before external/public release.
- Confirm web export/reset endpoints remain functional as the interim account fallback.
- Add App Review notes explaining the web fallback if native export/delete is not yet available.
- Confirm deletion expectations cover profile data, meal logs, reusable meals, nutrition preferences, and account/session records.
- Do not claim complete native account management until native sign-in, export, delete, and session handling are implemented and manually tested.

## Required before TestFlight upload
- Final bundle identifier and App Store Connect app record.
- Apple Developer Team/signing selected in Xcode.
- Final original app icon assets.
- App Store screenshots captured from approved simulator/device states.
- Privacy labels and review notes finalized.
- Manual simulator and real-device QA completed and recorded.
