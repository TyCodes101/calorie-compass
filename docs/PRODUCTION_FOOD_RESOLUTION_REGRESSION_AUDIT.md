# Production Food Resolution Regression Audit

## Scope

This release-blocking pass started from `main` after PR #48. It adds no nutrition providers and does not change review-before-save or save idempotency. The work hardens the path:

`user text -> meal intent -> item decomposition -> provider candidates -> identity/ranking -> one-time serving scale -> finalized PendingMeal -> iOS review -> confirmed save -> history`

The authoritative meal is the finalized normalized item list. Assistant copy, pending totals, review cards, save payloads, and history must all derive from that list.

## Failure Audit

### 1. `200g chicken breast` became two foods

- Observed: both chicken breast and grilled chicken breast were materialized.
- Root cause: deduplication handled exact labels but not preparation aliases, so a canonical item and a provider/model preparation variant could both survive as requested foods.
- Fix: `suppressNearDuplicateResolvedItems` now compares canonical identities with preparation aliases removed, keeps the strongest source-backed candidate, and permits repeats only when the input explicitly repeats the food.
- Files: `lib/ai/runMealAssistant.ts`, `tests/production-food-regressions.test.ts`.

### 2. Basic generic foods fell to estimates

- Observed: grilled chicken, large eggs, and cooked rice were labeled as AI estimates.
- Root cause: query normalization removed preparation words; USDA ranking did not strongly enforce cooked/raw or white/brown identity; USDA household measures were not used as natural count servings.
- Fix: preparation tokens remain in provider queries, USDA scores preparation conflicts deterministically, and USDA `foodMeasures`/household text can supply natural units and gram weights.
- Files: `lib/nutrition/normalizeFoodQuery.ts`, `lib/nutrition/providers/usda.ts`.

### 3. `200g cooked white rice` returned impossible nutrition

- Observed: 600 calories, 30g protein, and 24g fat.
- Root cause: cooked state could be removed before ranking, dry/incorrect candidates were insufficiently penalized, and no final cooked-starch category barrier rejected the resulting macro density.
- Fix: cooked/raw conflicts carry a large ranking penalty, nutrition is scaled once from one selected candidate, and plain cooked starch has broad calorie/protein/fat density barriers. Invalid candidates fall through rather than re-entering as trusted results.
- Files: `lib/nutrition/providers/usda.ts`, `lib/nutrition/accuracyEngine.ts`, `lib/nutrition/scaling.ts`.

### 4. Cheetos typo edit lost identity and provenance

- Observed: a serving edit produced `Cheetos Cheetos...`, changed structured data to an AI estimate, and changed macros implausibly.
- Root cause: `cheeots` was not normalized; the edit path performed open-ended resolution instead of editing the selected candidate; display-name composition always prepended brand; serving basis and provider identity were dropped by normalization and iOS round trips.
- Fix: typo normalization, canonical provider display names, identity-aware serving edits, immutable nutrition basis, and complete backend/iOS metadata round trips.
- Files: `lib/ai/runMealAssistant.ts`, `lib/ai/normalize.ts`, `lib/nutrition/providers/providerNormalization.ts`, `lib/nutrition/scaling.ts`, `ios/CalorieCompass/BackendService.swift`, `ios/CalorieCompass/MealReviewCard.swift`.

### 5. Multi-item requests collapsed

- Observed: `2 eggs and a banana` became one egg item with a combined name.
- Root cause: deterministic decomposition ran only in the no-model path. A collapsed structured model response could bypass it.
- Fix: model output is now validated against deterministic known-item decomposition. When the validator finds more independently named foods than the model emitted, it replaces the collapsed item list before nutrition lookup. Protected phrases such as mac and cheese, peanut butter and jelly sandwich, and brand-only ambiguity are not naively split.
- Files: `lib/ai/runMealAssistant.ts`, `tests/production-food-regressions.test.ts`.

### 6. Restaurant modifiers were ignored but labeled verified

- Observed: `McDouble no cheese no ketchup` retained base nutrition and a fully verified label.
- Root cause: modifier extraction covered only a subset of removals and the item schema could not distinguish structured base provenance from modifier-resolution confidence.
- Fix: requested modifiers, modifier resolution, and review status are separate fields. Unresolved customization keeps official base provenance but becomes `Needs Review`, is not trusted as exact customized nutrition, and is visible on the review card.
- Files: `lib/ai/types.ts`, `lib/ai/runMealAssistant.ts`, `app/api/meals/route.ts`, `ios/CalorieCompass/MealReviewCard.swift`.

### 7. `2 McDoubles no cheese` failed

- Observed: the singular form resolved while plural quantity plus modifier was rejected.
- Root cause: restaurant detection and fallback matching expected singular `McDouble`; quantity could remain embedded in identity; removal adjustments could be applied without the requested count.
- Fix: plural identity normalization, `2x` support, resolve-one-then-scale behavior, and quantity-aware modifier adjustment. Quantity is applied once after the per-item result is finalized.
- Files: `lib/ai/runMealAssistant.ts`, `lib/nutrition/normalizeFoodQuery.ts`.

### 8. Assistant summary and review card disagreed

- Observed: assistant text referenced old Cheetos state while the card showed only McDouble.
- Root cause: client responses had no active operation guard, and the client accepted `meal.items` without reconciling it to the active pending state. Pending signatures also ignored metadata-only changes.
- Fix: each iOS request has a UUID propagated as `X-Request-ID`; only the latest request may mutate UI state. Active `pendingMeal.items` are authoritative, mismatched copy is regenerated from those items, and pending signatures include source/candidate/modifier/review metadata.
- Files: `lib/ai/mealPendingState.ts`, `ios/CalorieCompass/BackendService.swift`, `ios/CalorieCompass/LogChatView.swift`.

### 9. Structured products were mislabeled estimated

- Observed: a structured Cheetos result became `Estimated` during an edit.
- Root cause: provenance, confidence, and review requirement were conflated, and optional structured metadata was dropped at normalization, native decoding, save, and history boundaries.
- Fix: provenance stays in `source_type`/provider IDs, confidence stays in `confidence_label`/numeric confidence, and review requirement stays in `review_status`. Save/history retain modifier truthfulness and provider candidate trace data without a database migration.
- Files: `lib/ai/types.ts`, `lib/ai/normalize.ts`, `lib/meals.ts`, `lib/native-meals.ts`, `app/api/meals/route.ts`, iOS models and review UI.

## Contracts

### Quantity and nutrition basis

- Requested quantity/unit describe what the user consumed.
- Provider quantity/unit and optional gram weight describe the source record.
- `scale_factor` is computed once.
- `base_nutrition` is immutable provider nutrition.
- Serving edits recalculate from immutable base nutrition, never from repeatedly rounded display values.
- Unsupported unit conversions are rejected instead of relabeling unchanged nutrition.

### Provenance and review

- A structured source can require review.
- An unresolved modifier cannot remain a fully verified customized result.
- An AI estimate cannot become verified.
- Provider identity and nutrition must share the same candidate ID.
- History restores official provenance while retaining a required-review state for unresolved customization.

### Pending meal consistency

- Pending item metadata changes increment the pending version.
- The pending item list determines totals, review cards, and save payload.
- An old iOS request ID cannot overwrite the latest request.
- Save remains explicit and idempotent per pending meal/version.

## Regression Coverage

`tests/production-food-regressions.test.ts` covers duplicate aliases, prepared-state queries, USDA cooked-rice ranking, USDA natural egg servings, impossible cooked-starch rejection, display-name deduplication, model-collapse repair, modifier honesty, plural quantity, serving edits, metadata-only pending versioning, stale-state replacement, protected food phrases, decimal/fraction quantities, and `2x` quantities.

Supporting persistence and native tests cover save schema metadata, idempotency, history restoration, immutable Swift serving edits, source/review labels, operation IDs, authoritative item reconciliation, and metadata round trips.

## Remaining Limits

- Restaurant component subtraction is exact only where component data exists. Otherwise the official base item remains visible with required review.
- USDA household measures vary by record; missing or incompatible measures can still require clarification.
- Homemade recipes and products absent from structured providers remain reviewable estimates.
- Final production behavior still requires TestFlight validation against deployed provider credentials and real network timing.
