# Food Logging Production Hardening Audit

## Lifecycle

1. The iOS chat composer sends a meal-assistant request with the current assistant state, conversation history, pending meal, and user context.
2. `/api/meal-assistant` validates the JSON contract, enriches the state with profile context, and runs the assistant/resolver pipeline.
3. The resolver prefers saved corrections and trusted/source-backed matches, then falls back to generic or estimated nutrition when identity is uncertain.
4. The assistant returns a reviewable pending meal with source metadata, confidence labels, and a stable pending meal id/version/idempotency key.
5. iOS keeps the review card visible and sends `/api/meals` only after explicit user confirmation.
6. `saveConfirmedMeal` persists the meal in a transaction, stores source metadata, updates daily logs, and rejects duplicate idempotency keys.

## Hardened Failure Modes

- Malformed or truncated meal-assistant JSON now returns a deterministic 400 before user lookup or assistant execution.
- Invalid meal-assistant request shapes now return a deterministic 400 instead of a generic server failure.
- Malformed or truncated save JSON now returns a deterministic 400 before dashboard or meal persistence work.
- Open Food Facts barcode payloads are trusted only when an actual finite energy field is present. Missing calorie data falls through to the normal fallback path instead of becoming a verified zero-calorie item.
- Concurrent duplicate saves are covered by a regression test for the database unique-constraint race path.

## Trust Invariants

- The backend still requires explicit save confirmation; assistant resolution alone does not persist a meal.
- Source metadata remains attached to pending meal items and saved meal items.
- Estimated or incomplete provider data must not be displayed as high-confidence verified nutrition.
- Idempotency keys remain stable per pending meal id/version and are enforced at the persistence layer.

## Remaining Manual QA

- Real-device TestFlight should still verify offline and flaky-network behavior, including app backgrounding during resolve/save.
- Production provider responses should be spot-checked for restaurant, branded, barcode, and generic foods.
- Vercel production should be promoted only after the branch CI and TestFlight smoke pass.
- Monitor logs after deploy for 400-rate spikes that indicate an iOS/backend contract mismatch.
