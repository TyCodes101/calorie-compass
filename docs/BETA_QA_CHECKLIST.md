# Beta QA Checklist (MacroMesh)

> Goal: catch dead-ends, missing Profile features, and guest-mode regressions before TestFlight.

## Install / first-run
- [ ] Install TestFlight build
- [ ] Launch app on a small iPhone size (SE/mini equivalent if available)
- [ ] Guest mode works without sign-in prompts blocking usage

## Profile (must-pass)
- [ ] Profile loads in guest mode
- [ ] Profile shows goal + calorie + macro targets summary
- [ ] Goal setup/update flow is visible and saves
- [ ] Weight tracking is visible and weight can be logged
- [ ] Weekly report is visible and loads
- [ ] Analytics/insights are visible and load
- [ ] Reminders settings are visible (and show permission status)
- [ ] Custom foods manager is visible and lists/deletes foods
- [ ] Account/privacy/session info is visible
- [ ] Retry/reload works (offline / backend slow)
- [ ] Empty/error/loading states are helpful (no dead-end “still getting ready”)

## Logging
- [ ] AI meal logging (review-before-save)
- [ ] Food Search
- [ ] Enter Barcode (manual)
- [ ] Quick Add (invalid values handled)
- [ ] Custom Food create flow
- [ ] Save meal updates Today

## Today / History
- [ ] Today dashboard loads (guest mode)
- [ ] History loads and handles empty state
- [ ] Deleting/editing meals doesn’t crash

## Permissions / offline
- [ ] Deny notifications → Reminders shows blocked state
- [ ] Deny camera/photos → barcode/OCR/photo flows fail gracefully
- [ ] Airplane mode → key screens show retry + non-destructive copy
