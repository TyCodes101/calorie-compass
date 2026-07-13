# Production Food QA Checklist

Run this checklist on a new TestFlight build connected to the intended production backend. Start from a cleared or saved meal before each standalone case unless the case explicitly describes a sequence.

For every case, verify nothing is saved until `Save meal` is confirmed, one confirmation creates one history record, and a repeated save tap does not duplicate it.

## Manual Matrix

| # | Input / sequence | Expected review behavior | Save and history |
|---|---|---|---|
| 1 | `200g chicken breast` | Exactly one chicken-breast card; 200g; no second grilled alias; plausible nutrition; structured source when available. | One visible item equals one saved item. |
| 2 | `200g grilled chicken breast` | Exactly one grilled chicken-breast card; preparation preserved; 200g; structured generic source; not AI estimate when USDA is available. | History retains source and 200g serving. |
| 3 | `2 large eggs` | One item with quantity 2 eggs; large/egg household serving; roughly plausible egg nutrition; structured source. | Saved quantity remains 2, not 200g. |
| 4 | `200g cooked white rice` | Cooked white rice, never dry/raw; 200g; roughly 240-300 calories, 4-7g protein, 50-65g carbs, low fat; known serving basis. | History matches the review values exactly. |
| 5 | `flamin hot cheetos` | One product card; no repeated `Cheetos` prefix; structured provider provenance if matched; confidence and review shown separately. | Do not save yet; continue to case 6. |
| 6 | `flamin hot cheeots 1 oz` | Existing Cheetos identity and provider candidate remain; serving becomes 1 oz; nutrition recalculates from base; no AI-estimate replacement. | Save payload and history keep the same product/source and 1 oz serving. |
| 7 | `McDouble no cheese no ketchup` | Both modifiers are visible. Exact component adjustment may be structured; otherwise show official base nutrition plus `Review`. Never show unchanged customized nutrition as fully verified. | History retains both requested modifiers and review status. |
| 8 | `2 McDoubles no cheese` | One card with quantity 2 (or two explicit equivalent items); canonical McDouble identity; no hidden base duplicate; no-cheese applies to both; totals scale once. | One save creates exactly the visible quantity and totals. |
| 9 | `2 eggs and a banana` | Exactly two cards, eggs and banana; each has its own serving, nutrition, source, and controls; totals include both. | Saved meal has exactly two items. |
| 10 | Scan or enter a valid leading-zero UPC/EAN | Leading zero is preserved; exact barcode result is preferred; no numeric conversion or unrelated generic result. | History retains the selected product identity/source. |
| 11 | Enter an unknown valid-format barcode | Calm not-found/fallback behavior; no fabricated exact barcode match; offer search/manual review path. | Nothing saves without a review item and confirmation. |
| 12 | Rapid sequence: send Cheetos, edit to 1 oz, then start McDouble | Latest request wins; no old response overwrites the card; summary, cards, totals, and pending state name the same foods. | Save contains only the visible finalized meal. |

## Additional Parser Checks

- `chicken, rice, and broccoli`: three independent items.
- `burger with fries`: burger and fries are separate.
- `mac and cheese`: one food phrase, not two items.
- `peanut butter and jelly sandwich`: one sandwich, not separate condiments.
- `Ben and Jerry's`: ask which product/flavor; do not split or invent one.
- `coffee with cream`: preserve as one drink/customization unless the product data models cream separately.
- `two bananas`: quantity 2.
- `1.5 cups cooked rice`: quantity 1.5 cups and cooked identity.
- `half a banana`: quantity 0.5.
- `2x McDouble`: quantity 2.

## UI and Trust Checks

- Requested modifiers are readable and do not wrap into broken badges.
- Official base nutrition with unresolved modifiers shows `Review` plus `Official base nutrition`.
- AI estimates show `Review` plus `AI estimate`, not duplicate `Estimated` badges.
- Quantity text never uses scientific notation.
- Changing between grams and ounces works only when a deterministic basis exists.
- An unsupported unit change does not silently keep the same macros under a new unit label.
- Save is disabled while saving.
- Keyboard/composer does not cover the review controls.
- VoiceOver reads food identity, serving, source, confidence/review, modifiers, and save controls clearly.
- Dynamic Type and dark mode keep all source/review text legible.

## Evidence to Record

For each case record build number, backend deployment commit, item count, canonical names, quantity/unit, calories/macros, source label, review label, save result, history result, and screenshot. Record provider request IDs from response headers or sanitized logs when investigating a failure; never record credentials.
