# Calorie Compass iOS Foundation

This folder starts the native iOS foundation for Calorie Compass. It is intentionally source-only right now: the web app remains the production app, and this folder does not claim App Store readiness.

## What exists

- `CalorieCompassApp.swift` wires a SwiftUI app root.
- `RootView.swift` defines the initial tab shell.
- `MealLoggerView.swift` is a chat-first logger with loading, retry, duplicate-submit prevention, and a review-before-save placeholder.
- `DashboardView.swift`, `HistoryView.swift`, and `ProfileView.swift` define first-pass native screens.
- `APIClient.swift` centralizes backend calls with a configurable `baseURL`.
- `MealAssistantModels.swift` mirrors the web app meal-assistant contract.
- `AppConfig.swift` reads `CALORIE_COMPASS_BASE_URL` from the environment or Info.plist, defaulting to production.

## How to create the Xcode project locally

1. Open Xcode.
2. Create a new iOS App project named `CalorieCompass`.
3. Choose SwiftUI for the interface and Swift for the language.
4. Copy the files in this `ios/` folder into the app target.
5. Add an Info.plist key named `CALORIE_COMPASS_BASE_URL` for local or preview builds if needed.
6. Point the value at either:
   - `https://calorie-compass-chi.vercel.app`
   - a local tunnel or LAN URL for `npm run dev`

Do not put OpenAI, database, or provider keys in the iOS app. The iOS app should only call the backend.

## Backend assumptions

- The backend owns OpenAI calls, nutrition lookup, database writes, and assistant memory.
- iOS sends user messages plus the current assistant state to `/api/meal-assistant`.
- iOS saves reviewed meals by POSTing to `/api/meals`.
- iOS reads dashboard/profile/session data from existing API routes.

## Known native gaps

- No `.xcodeproj` is committed yet.
- No native authentication flow yet.
- No dedicated `/api/history` endpoint yet.
- No native barcode scanner yet.
- No nutrition label OCR yet.
- No meal photo recognition yet.
- No push/local notification implementation yet.
- No crash/error telemetry SDK yet.
- No simulator/device QA has been run in this environment.

See `BackendContract.md` and `AppStoreReadiness.md` for the current contract and release checklist.
