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

## Support and contact URL checklist
- Confirm a public support URL before App Store submission.
- Confirm a public privacy policy URL before App Store submission.
- Confirm the support page explains how users can request help with meal logs, account access, export, or deletion.
- Confirm support and privacy URLs are stable, HTTPS, and accessible without a signed-in session.
- Do not use a private preview URL in App Store Connect.

## Privacy nutrition label checklist
Review App Store Connect privacy labels for these categories before upload:

- Meal logs and raw food descriptions.
- Nutrition estimates and saved meal history.
- Profile fields such as name, age, height, weight, calorie goal, protein goal, and nutrition preferences.
- Account/session identifiers from backend sessions.
- Diagnostics or crash data only if a crash-reporting implementation is added later.
- Analytics data only if product analytics are added later.

Do not label telemetry/crash/analytics collection as active until a real implementation exists and is reviewed. Do not log raw meal text, profile details, auth tokens, cookies, Apple provider responses, API keys, or database/provider credentials.

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
