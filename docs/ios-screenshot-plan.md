# iOS Screenshot Shot List

Phase 4F plans screenshot capture for App Store/TestFlight handoff. Screenshots have not been captured in this environment.

## Capture rules
- Use only sample or tester-approved meal/profile data.
- Avoid private real meal logs, names, profile details, auth/session tokens, or debug output.
- Capture light mode first, then dark mode only if needed for review or QA evidence.
- Use production backend for upload-candidate screenshots unless explicitly testing a local tunnel.
- Do not show placeholder app icons in assets intended for App Store submission.
- Keep copy truthful: no claims about real Sign in with Apple, premium, subscriptions, medical advice, or final TestFlight readiness.

## Recommended device sizes
- Current large iPhone simulator or device for primary App Store screenshots.
- Small iPhone simulator, such as iPhone SE, for truncation and layout checks.
- Optional iPad capture only after iPad layout is intentionally reviewed, because the app currently targets iPhone and iPad families.

## Shot list

### 1. Dashboard / Today
- Goal: show daily calorie and macro progress with recent meal context.
- State: successful backend load with representative sample data.
- Suggested caption: `See your day at a glance`
- QA notes: verify numbers are legible, no loading spinner remains, and recent meals do not include private data.

### 2. Conversational Logger
- Goal: show natural-language meal entry.
- State: typed example meal before sending, or assistant response after parsing.
- Suggested caption: `Log meals in plain language`
- QA notes: keyboard should not cover the input, placeholder copy should not imply medical precision, and no API/provider details should appear.

### 3. Meal Review / Save
- Goal: show review-before-save with editable food items and nutrition estimates.
- State: parsed meal review card with multiple items and enabled save action.
- Suggested caption: `Review estimates before saving`
- QA notes: disclaimer language should remain visible or reachable, save action should be clear, and remove/edit controls should be tappable.

### 4. History
- Goal: show saved meals as a usable history list.
- State: multiple saved meals with dates and totals.
- Suggested caption: `Revisit meals anytime`
- QA notes: avoid duplicate sample meals that look broken, and confirm empty/error states are not accidentally captured.

### 5. Meal Detail / Edit
- Goal: show that saved meals can be inspected and corrected.
- State: detail view with meal type/date/nutrients visible.
- Suggested caption: `Adjust details when needed`
- QA notes: do not show destructive delete confirmation unless the screenshot specifically documents QA.

### 6. Profile / Guest Account State
- Goal: show goals and the current guest/account limitation honestly.
- State: profile loaded, guest mode visible, disabled Apple sign-in marked coming soon.
- Suggested caption: `Keep goals in view`
- QA notes: confirm the screenshot does not claim native account sign-in is active and does not show private profile data.

### 7. Offline or Session State
- Goal: show safe retry/session messaging if needed for review notes.
- State: offline banner or session-expired state with retry affordance.
- Suggested caption: `Clear states when connection changes`
- QA notes: use only if the message is polished and not alarming.

## Copy guidance
- Prefer short benefit-led copy tied to the visible screen.
- Avoid quantified medical outcomes, weight-loss promises, diagnosis, treatment, or guaranteed accuracy.
- Use `estimate`, `review`, `track`, and `history` language instead of `diagnose`, `prescribe`, or `guarantee`.
- Keep all captions consistent with guest mode and scaffold-only native auth.

## Screenshot Handoff Checklist (for App Store/TestFlight)
- Before upload/review, complete/check off:
  - Record: device model, simulator/device used, iOS version, app build number, backend environment, and date/capture context.
  - Only store final published screenshot exports outside the repo unless clearly adding review assets.
  - NEVER commit rejected, partial, or private screenshots—repo must not contain user/tester real data or rejected assets.
  - Pair each kept/staged screenshot with the corresponding completed manual QA template (see runbook).
  - Confirm that actual (non-placeholder) app icon appears in all intended App Store imagery (never show placeholder/missing asset in submitted screenshots).
  - Confirm that captions, visible data, and UI state match the real current guest-mode/feature reality—never fake availability of premium, Sign in with Apple, or unimplemented features.
