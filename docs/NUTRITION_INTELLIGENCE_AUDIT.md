# Nutrition Intelligence Audit Report

Date: 2026-05-29
Branch: `feature/codemagic-ios-ci`
Scope: food intelligence only. No Codemagic, signing, provisioning, TestFlight, App Store metadata, unrelated screens, or unrelated architecture.

## Executive summary

Calorie Compass already has a trust-first architecture, but the implementation is uneven. The system combines deterministic catalog matching, USDA lookup, optional Nutritionix lookup, barcode/Open Food Facts lookup, saved-correction reuse, AI extraction, and local assistant heuristics. The strongest current asset is the local verified catalog plus deterministic restaurant/branded matching. The largest trust risks are provider ordering, limited confidence vocabulary, partial provenance, limited sanity validation, and inconsistent handling between direct parse, meal assistant, web review, saved meals, and native models.

Important finding: the documented source priority says local catalog -> USDA -> commercial provider -> AI. The requested future hierarchy wants exact branded and exact restaurant matches before verified generic database matches. The current implementation often satisfies this through local catalog first, but not globally. USDA currently runs before Nutritionix, which can let a generic/USDA result win before a configured commercial branded source. That is the main structural mismatch with the mission.

## 1. Current food recognition flow

### Web/direct meal parsing

Primary entry: `lib/ai/openai.ts` via `parseMealText()`.

Flow:
1. Build an effective meal text from the user text plus optional correction/clarification context.
2. Analyze text with `analyzeMealText()`.
3. Decide whether clarification is needed with `buildClarificationDecision()`.
4. Infer meal type with `inferMealType()`.
5. If barcode or manual nutrition label exists, call `resolveNutritionEstimate()` first.
6. If no clarification is needed, call `resolveNutritionEstimate()` before model parsing.
7. If structured resolution fails and no OpenAI key exists, use mock parser and hydrate with providers.
8. If OpenAI is available, ask model for structured JSON, normalize it, then hydrate model items through providers.
9. Final confidence score is recalculated by `finalizeParsedResponse()`.

### Conversational meal assistant

Primary entry: `lib/ai/runMealAssistant.ts`.

Flow is more complex:
1. Split mixed food-plus-question turns with `splitMixedIntentMessage()`.
2. Handle deterministic commands/corrections/removals/save/discard where possible.
3. Detect known foods via local heuristics and catalog-backed estimates.
4. For item nutrition, `defaultResolveItemNutrition()` calls `resolveNutritionEstimate()` first, then `parseMealText()`, then mock fallback.
5. Restaurant fallback logic can replace known generic-ish items with trusted restaurant items when restaurant cues exist.
6. Assistant state carries `currentMealItems`, `currentMealText`, confidence, edit IDs, and saved status.

### Native iOS client

Primary files: `ios/CalorieCompass/BackendService.swift`, `LogChatView.swift`, `MealReviewCard.swift`.

Native does not independently compute nutrition. It:
- sends assistant requests to backend routes;
- preserves metadata fields (`source_type`, `source_name`, `confidence_label`, `catalog_food_id`, `is_trusted`);
- applies some local commands and review-card edits/removals;
- saves only after explicit user action from reviewed state.

## 2. Current nutrition lookup flow

Primary entry: `lib/nutrition/resolver.ts`.

Order in `resolveNutritionEstimate()`:
1. Manual nutrition label -> `lookupNutrition()`.
2. Barcode detected/provided -> Open Food Facts barcode lookup.
3. Saved correction reuse from recent user meals.
4. `lookupNutrition()`.

Order in `lookupNutrition()`:
1. Manual label if present.
2. Normalize query with `normalizeFoodQuery()`.
3. Providers in this order:
   - `localVerifiedCatalogProvider`
   - `usdaProvider`
   - `commercialDatabaseProvider`
4. Optional AI estimate provider if explicitly passed.
5. Otherwise `null`.

Hydration flow in `hydrateParsedMealWithProviders()`:
1. For each model/estimated item, build a lookup text.
2. Call `lookupNutrition()`.
3. If a provider returns items, replace/hydrate with those provider items.
4. If no provider returns anything, mark/decorate the original item as `AI_ESTIMATE`.

## 3. Current confidence scoring flow

### Meal-level confidence

`lib/ai/confidence.ts` exposes `scoreMealConfidence()`.

Inputs:
- text analysis signals: brand, portion, cooking style, sauce signal, multiple items, specificity, simple category;
- item count;
- clarification needed;
- trusted/estimated item counts.

Behavior:
- starts at 0.58;
- adds for brand, portion, cooking style, specificity, simple meals, multiple items;
- subtracts for low specificity, clarification, estimated items;
- clamps between 0.2 and 0.95.

Risk: the score is mostly recognition-text based, not source-quality-path based. It knows trusted vs estimated counts, but it does not distinguish exact branded match vs exact restaurant match vs USDA generic vs close branded vs user-provided label. It can make the meal look confident because the text was specific, even when a nutrition source is weaker.

### Item-level verification

Current item labels are limited by schema to:
- `Verified`
- `Estimated`
- `Matched`
- `Needs Review`

The canonical item labels are verification states, not user-facing confidence bands. Numeric confidence remains internal for ranking and diagnostics.

### Display copy

`lib/trust.ts` maps item metadata to badges and helper text. It supports tones:
- verified
- branded
- generic
- estimated

`getConfidenceCopy()` maps meal score into three copy buckets, not four requested levels.

## 4. Current fallback flow

Fallbacks exist at multiple layers:

1. **Open Food Facts barcode fallback**: if barcode lookup fails, continues to saved correction and lookup providers.
2. **Saved correction fallback**: exact normalized raw-text match from recent meals can return user’s previous values.
3. **Provider fallback**: local catalog -> USDA -> Nutritionix.
4. **AI/model fallback**: model output is hydrated; unhydrated items become `AI_ESTIMATE`.
5. **Trusted catalog heuristic fallback**: `getTrustedCatalogEstimate()` can return catalog items plus estimated fallback segments for partial meals.
6. **Mock fallback**: used when no OpenAI key or parsing fails.
7. **Assistant fallback**: if item resolution fails, `defaultResolveItemNutrition()` falls back to `parseMealText()`, then mock parsed meal.

Risks:
- Fallback paths are not represented as a structured list; only `provider_used`, `used_ai_fallback`, `matched_query`, and notes trace some of it.
- Some fallback estimates are hard-coded in `trusted.ts` and marked as `AI_ESTIMATE`, but there is no automated sanity conflict check before display.
- Saved correction confidence is boosted to at least 0.9 if previous source was non-AI, which may be too high if the prior save was user-edited or stale.

## 5. Current source attribution flow

Fields available on `ParsedFoodItem`:
- `is_trusted`
- `source_type`
- `source_name`
- `confidence_label`
- `matched_query`
- `original_user_text`
- `provider_used`
- `used_ai_fallback`
- `catalog_food_id`
- `sourceId`
- `confidence`

Persistence:
- `Meal` stores meal-level `confidenceScore`.
- `FoodItem` stores `nutritionSourceType`, `nutritionSourceName`, `catalogFoodId`, and trace text in notes.
- `ReusableMealItem` stores `isTrusted`, `sourceType`, `sourceName`, and `catalogFoodId`.

Gaps:
- `FoodItem` does not have first-class columns for `matched_query`, `original_user_text`, `provider_used`, `used_ai_fallback`, source freshness, fallback path, source version, match score, or confidence explanation. Those are embedded into notes via `buildStoredItemNotes()`.
- API GET `mapMealForNative()` returns `source_type` and `source_name`, but not `confidence_label`, `matched_query`, `provider_used`, or `catalog_food_id` for history/native display.
- Catalog source records have citation strings, but no actual URL, retrieval date, version, freshness timestamp, or license metadata.

## 6. Current branded food handling

Main mechanisms:
- `data/nutrition-catalog.json` contains 67 foods and 30 sources.
- Branded packaged food detection exists in `lib/ai/trusted.ts` for Fairlife, Core Power, Premier Protein, Quest, Quaker, Trader Joe’s, Gatorade, Celsius, Coca-Cola, and Oikos.
- `normalizeFoodQuery.ts` has brand hints for McDonald’s, Taco Bell, Chipotle, Chick-fil-A, Little Caesars, Starbucks, Fairlife, Core Power, Quest, Premier Protein, and Quaker.
- `findCatalogFoodMatch()` uses alias overlap, exact alias/product flags, protein signal matching, and brand hints.

Strengths:
- Exact catalog aliases can preserve product names and source metadata.
- Fairlife/Core Power protein-signal logic improves product discrimination.
- Known packaged brands are usually kept out of generic fallback if catalog match succeeds.

Gaps:
- The requested brand list is broader than current robust support. Current catalog has limited/none for David, Chobani, Kodiak, Pepsi, Panera packaged items, Subway packaged variants, Wendy’s broader menu, etc.
- Typo tolerance is mostly manual replacements and token overlap, not edit-distance/fuzzy matching.
- Nutritionix is after USDA, so a configured commercial branded source can lose to USDA generic/branded search.
- `source_type` has no dedicated `BRANDED` value; branded foods are usually `GENERIC_REFERENCE`, making provenance less precise.

## 7. Current restaurant food handling

Main mechanisms:
- `detectRestaurantBrand()` in `trusted.ts` recognizes Chipotle, Starbucks, Chick-fil-A, McDonald’s, Panda Express, Subway, Taco Bell, Wendy’s, CAVA, Panera, Burger King, Domino’s, Pizza Hut, Raising Cane’s/Cane’s, Popeyes, Dunkin’, KFC, Five Guys, Jersey Mike’s.
- Brand-specific matchers exist for Chipotle, Starbucks, Chick-fil-A, McDonald’s, and a small Taco Bell case.
- Other brands rely more on `findCatalogFoodByBestMatch()` over catalog aliases.
- Restaurant items are marked `OFFICIAL_RESTAURANT` when catalog source type is official restaurant.

Strengths:
- Exact restaurant catalog hits get high confidence and source attribution.
- Common menu names can be preserved if present in catalog.
- Mixed restaurant segments can produce multiple items.

Gaps:
- Catalog coverage is small for many restaurants. Some requested restaurants have only one or two foods.
- McDonald’s matcher covers McDouble, cheeseburger, fries, drinks, but the dedicated matcher does not explicitly handle Big Mac; Big Mac likely depends on catalog alias matching if present.
- Starbucks matcher has limited latte and bacon gouda support; “Venti Iced Vanilla Latte” specificity may not be preserved unless catalog aliases cover it.
- Restaurant source freshness/licensing is not tracked beyond generic citation text.

## 8. Current correction handling

### Web/direct parsing

`parseMealText()` can build effective text with previous meal and correction text. The model prompt instructs correction behavior, and hydrated response is normalized.

### Meal assistant

`runMealAssistant.ts` contains extensive correction/removal/mutation logic:
- correction target parsing;
- quantity adjustment;
- swap/replacement handling;
- remove commands;
- state preservation;
- wrong-target and ambiguity safeguards;
- save/discard commands.

### Saved correction reuse

`resolveFromSavedCorrection()` searches recent meals for an exact normalized raw text match and reuses previous item values.

Gaps:
- Repeated correction learning is not modeled as a structured correction table or preference system.
- Saved corrections are exact-text only; they do not generalize safely across typo/flavor/brand variants.
- No explicit guard prevents user corrections from being accidentally treated as globally verified branded nutrition; current code marks saved non-AI corrections as verified-ish if prior source type was non-AI.

## Nutrition sources inventory

| Source | Where used | Data quality | Coverage | Freshness | Licensing concerns | Failure modes |
|---|---|---:|---:|---|---|---|
| Local verified catalog (`data/nutrition-catalog.json`) | `localVerifiedCatalogProvider`, `trusted.ts` | High when entries are accurate | Small: 67 foods, 30 sources | Static, no update timestamp per item | Citations are plain labels, not legal/license metadata | Stale menu data, limited aliases, partial restaurant menus, branded variants missing |
| Official restaurant catalog records | source type `OFFICIAL_RESTAURANT` | High for exact menu items | Limited per brand | Static, no retrieval/version date | Official menu nutrition may have usage restrictions; no URL/license tracked | Wrong item if alias fuzzy match overreaches; missing size/customizations |
| Branded catalog records | source type currently `GENERIC_REFERENCE` with brand | Medium-high for exact product | Limited products | Static | Brand nutrition references not linked/licensed | Flavors/sizes not covered; branded provenance indistinct from generic |
| USDA FoodData Central | `usdaProvider` | High for generic foods; mixed for branded search | Broad | External live API; no fetched date persisted | Public US government data generally usable, but API terms should still be checked | Generic result can replace branded intent; serving conversion mismatch; top search result errors |
| Nutritionix | `commercialDatabaseProvider` | Potentially high for branded/restaurant, depending result | Broad if configured | External live API | Commercial API terms/license must be followed | Not configured by default; natural endpoint may return generic first; source placed after USDA |
| Open Food Facts | barcode in `resolver.ts` | Medium; crowd-sourced | Broad packaged goods | External live API; no fetched date persisted | Open Database License attribution/share-alike implications should be reviewed | Missing product, inaccurate crowd data, per-serving vs per-100g ambiguity |
| User-provided nutrition label | `makeLabelResponse()` | High for user’s package if entered correctly | User-provided only | Fresh at time of entry | User input; no external licensing | User typo; no sanity check; source type `GENERIC_REFERENCE` hides manual nature |
| Saved correction/recent meal | `resolveFromSavedCorrection()` | Good for the same user’s repeated exact meal | User-specific, exact text only | Recent 20 meals | Private user data, internal only | Can over-trust prior wrong edit; exact-match only; confidence inflated |
| AI/model estimate | OpenAI, mock, hard-coded estimates | Variable | Broad | Model-dependent | Model/API terms apply | Hallucinated foods/macros, inconsistent runs, false precision |
| Hard-coded fallback estimates | `trusted.ts`, mock/parser helpers | Medium-low | Narrow common cases | Static | Internal estimates; should cite basis if possible | May become silently trusted if metadata is lost; no conflict/sanity engine |

## Places where generic foods can replace branded foods

1. `lookupNutrition()` provider order runs USDA before Nutritionix. For branded text not in local catalog, USDA can return generic or branded-ish results before a commercial branded lookup is attempted.
2. `normalizeFoodQuery()` removes many filler terms and canonicalizes some compounds; if brand hints are absent or typoed, branded text can become a generic compound like “protein bar”, “chips”, or “rice cake”.
3. `hydrateParsedMealWithProviders()` builds lookup text from model item names. If the model already dropped the brand, hydration may never recover it.
4. `repairResolvedNutritionItem()` intentionally changes toast/bread and generic names for UX, but similar repair rules are not consistently provenance-aware for branded items.
5. `getTrustedCatalogEstimate()` estimates unmatched packaged snack segments as generic `Chips` if branded matching fails.

## Places where confidence may be inflated

1. `scoreMealConfidence()` adds confidence for brand mention before proving an exact branded nutrition match.
2. Meal-level score can reach high values with all trusted items, but “trusted” includes generic references and USDA; it does not distinguish exact vs close match.
3. Saved corrections boost to at least 0.9 when prior item had non-AI source type.
4. Manual nutrition label gets 0.98 and `Verified`; this is appropriate if user copied a label correctly, but should be labeled “User-provided” rather than verified database truth.
5. Local catalog branded items now use `Verified` or `Matched`, but exact/close distinction still depends on match metadata quality.

## Places where nutrition is guessed unnecessarily

1. If local catalog misses a branded product and USDA/Nutritionix are unavailable or fail, AI/model/hard-coded fallback estimates can be used rather than asking for barcode/label.
2. Some restaurant segments fall to estimated fries/chips/cookies when catalog aliases miss.
3. `parseMealText()` now clarifies common vague meals such as chips, protein shakes, salads, bowls, sandwiches, and fries before returning nutrition.

## Places where sources are lost or weakened

1. GET meal API for native/history omits several provenance fields.
2. Persistence stores trace metadata in notes instead of normalized columns.
3. `source_type` only supports official restaurant, generic reference, and AI estimate. Branded, USDA, Open Food Facts, Nutritionix, user label, saved correction, and local verified catalog are overloaded into `GENERIC_REFERENCE` plus `source_name`.
4. Some native history models only round-trip a subset of metadata.
5. `catalog_food_id` is persisted only if the ID exists in DB catalog; local-only or unsynced catalog IDs are dropped.

## Places where estimates can become inconsistent

1. AI model outputs are probabilistic and only temperature is controlled. Different model runs can produce different item names/portion assumptions before hydration.
2. External providers can change results over time; no source snapshot or version is stored.
3. USDA top-result scoring can change with API results and query normalization.
4. Saved correction reuse depends on last 20 meals and exact normalized raw-text match.
5. Hard-coded estimates, catalog values, USDA values, Nutritionix values, and model estimates can disagree without a conflict resolver.

## Current benchmark/test coverage observed

Relevant existing tests include:
- `tests/nutrition-lookup.test.ts`
- `tests/ai-trusted-catalog.test.ts`
- `tests/ai-restaurant.test.ts`
- `tests/assistant-qa.test.ts`
- `tests/assistant-real-user-gauntlet.test.ts`
- `tests/meal-assistant-conversation.test.ts`
- `tests/meal-assistant-runner.test.ts`
- `tests/meal-logger-client.test.tsx`
- `ios/CalorieCompassTests/MealManagementTests.swift`

Coverage is strong for behavior regressions and some branded/restaurant cases, but there is not yet a formal baseline benchmark with 25 branded, 25 restaurant, 25 grocery, 25 typo, and 25 correction scenarios. Accuracy claims should not be made until that benchmark exists.

## Phase 0 conclusions

The current pipeline is directionally correct but not yet best-in-class. It has good trust primitives, but they need to become a first-class nutrition intelligence layer rather than scattered metadata and heuristics.

Most important work before expanding food catalogs:
1. Introduce a formal source ranking/result object that carries candidate type, source quality, exactness, match score, serving certainty, freshness, and fallback path.
2. Reorder/reshape providers so exact branded and exact restaurant matches always beat generic database matches.
3. Keep verification labels first-class and preserve the internal score only for ranking and diagnostics.
4. Add a sanity/conflict engine before any item reaches review.
5. Preserve provenance in first-class fields, not just notes.
6. Build the baseline benchmark before claiming improvements.

## Recommended implementation sequence after this audit

1. Add benchmark harness and baseline fixture categories first, so improvements are measurable.
2. Add nutrition source ranking types and candidate scoring without changing UI.
3. Add sanity validation and conflict flags.
4. Add confidence/provenance fields in API types and UI debug surfaces.
5. Expand local catalog for requested brands/restaurants with explicit source metadata.
6. Re-run benchmark and only then report measured accuracy deltas.
