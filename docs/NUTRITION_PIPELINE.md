# Nutrition Pipeline — Calorie Compass

Calorie Compass uses a trust-first nutrition pipeline. The goal is to log meals quickly while being honest about where nutrition data came from and how the match was verified.

## Source Priority

Use sources in this order:

1. **Verified local catalog first**
2. **USDA FoodData Central second**
3. **Commercial provider slot third**
4. **AI fallback last**

Structured and verified data should always beat generated guesses.

## 1. Verified Local Catalog

The local catalog is the highest-trust source.

Use it for:

- App-verified foods.
- Previously normalized common foods.
- User-confirmed recurring meals.
- Known branded items stored locally.
- Stable defaults created from past corrections.

Requirements:

- Preserve catalog item ID/version when available.
- Keep serving units explicit.
- Mark the result with the strongest trust badge.
- Prefer exact local matches over broader external matches.

## 2. USDA FoodData Central

Use USDA FoodData Central when the local catalog does not contain a strong match.

Use it for:

- Generic whole foods.
- Common ingredients.
- Standardized nutrition references.
- Foods where an official database match is better than AI estimation.

Requirements:

- Store USDA/FDC identifiers when available.
- Preserve serving basis and conversion assumptions.
- Clearly distinguish generic USDA matches from brand-specific items.
- Use `Verified` or `Matched` depending on source quality and match specificity.

## 3. Commercial Provider Slot

The commercial provider slot is reserved for future or configured third-party nutrition data providers.

Use it for:

- Branded grocery products.
- Restaurant menu items.
- Barcode-based lookups.
- Provider-verified packaged foods.

Requirements:

- Keep provider name and item ID in metadata.
- Do not hard-code a provider as permanently required.
- Treat provider data as structured, but still surface verification based on match quality.
- Fall back gracefully if no provider is configured or the provider fails.

## 4. AI Fallback Last

AI fallback is used only when structured sources cannot satisfy the meal request well enough.

Use it for:

- Natural-language mixed meals.
- Homemade recipes without exact measurements.
- Ambiguous meals only after the user clarifies the brand, restaurant, serving, or preparation that materially changes nutrition.
- Initial estimates that the user can correct.

Requirements:

- Label AI-generated estimates clearly.
- Store assumptions: ingredients, serving size, preparation method, and portion guesses.
- Use conservative verification labels.
- Never present AI fallback nutrition as exact.
- Prefer asking a follow-up if the missing information would materially change calories/macros.

## Verification Badges

Every logged nutrition result should be eligible for a verification badge:

- **Verified** - local catalog, official restaurant, label scan, or user-confirmed recurring item.
- **Matched** - USDA or structured provider data with a plausible serving match.
- **Estimated** - AI or heuristic estimate with stated assumptions.
- **Needs Review** - missing critical serving information, unresolved ambiguity, or validation concern.

Verification badges should help users understand the estimate without slowing down logging.

## Verification Labels

Use only these item-level labels alongside source metadata:

- **Verified**: exact local, official restaurant, label, or user-confirmed match with clear serving size.
- **Matched**: structured database/provider match with acceptable serving and macro plausibility.
- **Estimated**: AI or heuristic fallback with stated assumptions.
- **Needs Review**: unresolved ambiguity, missing serving, brand mismatch, or macro plausibility concern.

Numeric confidence can remain internal for ranking, but it must not be shown as a user-facing label. Every result still goes through review before save.

## Source Metadata

Preserve metadata whenever possible:

- Source type: `local_catalog`, `usda_fdc`, `commercial_provider`, `ai_fallback`.
- Source item ID or provider ID.
- Match score or confidence score if available.
- Serving size and unit.
- Conversion assumptions.
- Ingredient assumptions for mixed meals.
- Timestamp and pipeline version when useful.

Metadata should support debugging, correction handling, and future model/pipeline improvements.

## Correction Flow

Corrections must update the existing item, not create duplicate noise.

When the user corrects a meal:

1. Identify the target logged item.
2. Apply the corrected food, serving, ingredient, calories, or macro value.
3. Recalculate affected totals.
4. Update dashboard state immediately.
5. Store the correction source/reason when useful.
6. If the correction represents a stable user preference, save it as future context.
7. Keep unrelated meal data unchanged.

Examples:

- “Actually that was two slices” → update serving quantity.
- “It was grilled chicken, not fried” → update preparation and nutrition assumptions.
- “My smoothie uses almond milk” → update item and consider remembering if recurring.
- “That brand has 180 calories” → update nutrition value and source as user-corrected.

## When to Ask Follow-up Questions

Ask one focused follow-up when the answer would materially change the estimate and the user has not provided enough information.

Good follow-up triggers:

- Missing portion size for calorie-dense foods.
- Ambiguous restaurant/brand item.
- Mixed meal with unclear main ingredients.
- Conflicting information in the user’s description.
- A low-confidence estimate would be misleading without clarification.

Good follow-up style:

- Ask one question, not a form.
- Offer quick choices when possible.
- Keep tone natural and low-friction.

Example:

> “About how much rice was it — half cup, one cup, or more like two?”

## When to Estimate Without Blocking

Estimate without blocking when asking would create more friction than value.

Estimate directly when:

- The meal is common and portion can be reasonably assumed.
- The user is clearly trying to log quickly.
- Missing details have a small nutrition impact.
- The assistant can state assumptions clearly.
- The item can be corrected easily afterward.

Example:

> “Logged a medium banana — estimated at 105 calories. You can tweak the size if that’s off.”

## Product Principle

The pipeline should feel fast first and trustworthy always. Ask when it matters. Estimate when it helps. Make corrections effortless.
