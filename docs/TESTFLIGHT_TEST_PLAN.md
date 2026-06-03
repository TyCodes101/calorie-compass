# TestFlight Test Plan (MacroMesh)

## Goal
Validate the shippable iOS experience end-to-end (guest mode first), focusing on Profile completeness + reliability.

## Smoke path (10 minutes)
1. Launch app (guest mode)
2. Log an AI meal → review → save
3. Confirm Today updates
4. Confirm History shows the meal
5. Open Profile:
   - goals summary + macro targets
   - goal setup/update visible
   - weight tracking visible
   - weekly report visible
   - analytics visible
   - reminders visible
   - custom foods manager visible

## Deep QA pass
- Offline/slow network behaviors
- Permission denied flows (camera/photos/notifications)
- Empty dataset behaviors (fresh guest)
- Quick Add invalid input handling
- Barcode not found handling
- Custom foods list empty + delete

## Reporting template
When filing bugs, include:
- Build number
- Device + iOS version
- Guest vs signed-in
- Exact steps
- Expected vs actual
- Screenshot/screen recording when possible
