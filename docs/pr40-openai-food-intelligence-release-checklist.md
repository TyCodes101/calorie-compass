# PR 40 OpenAI Food Intelligence Release Checklist

This checklist gates PR #40, `feature/openai-food-intelligence-layer`.

## Before Merge

- PR #40 is open, mergeable, and targets `main`.
- GitHub Actions iOS CI is green for the PR head commit.
- Vercel preview deployment is green for the PR head commit.
- Full Vitest suite is green.
- Focused OpenAI/security/API tests are green.
- Meal assistant and pending meal state tests are green.
- Food gauntlet, fuzz, trust, resolver, API failure, and idempotency tests are green.
- `eslint` is clean.
- `next build` succeeds.
- `node --check scripts/smoke-openai-food-intelligence.mjs` succeeds.
- No OpenAI key is exposed through `NEXT_PUBLIC_*`, Swift/iOS code, browser/client bundles, logs, or API responses.
- OpenAI output remains intent-only; nutrition trust still comes from resolver, catalog, provider, and pending-review flow.

## After Merge

- Confirm Vercel production deploys from `main`.
- Confirm production Vercel has `OPENAI_API_KEY` set server-side.
- Confirm optional production `OPENAI_MEAL_MODEL` is either unset or intentionally set.
- Confirm optional `OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS` is either unset or intentionally set.
- Run the real OpenAI smoke script from a secure shell if a production-safe key is available:

```bash
node scripts/smoke-openai-food-intelligence.mjs
```

- Confirm smoke output has no schema/system failures.
- Confirm no API key or raw OpenAI output appears in logs or client responses.
- Run TestFlight smoke against the production backend.
- Confirm save-once/idempotency behavior still works from the native app.
- Confirm history shows source metadata after a saved meal.

## TestFlight Smoke Prompts

- Wendy's Baconator.
- Wendy's Baconnator.
- McDouble no cheese.
- McDonald's McDouble without cheese.
- Subway meatball footlong.
- Chipotle chicken bowl.
- Arby's roast beef.
- Diet Coke.
- Coke Zero.
- hot cheeots.
- Quest chips.
- Fairlife protein shake.
- 2 grilled chicken breasts and asparagus.
- buttered corn on the cob.
- breakfast sandwich.
- bowl.
- chicken sandwich.
- where's my macros.
- yes twice.
- save it twice.
- add McDouble no cheese.
- replace with McDouble no cheese.
- nvm.
- undo.
- start over.

## Expected Outcomes

- Trusted known foods resolve to source-backed or reviewable entries.
- Ambiguous foods clarify or remain clearly reviewable.
- Generic foods stay estimated/reviewable.
- `yes`, `save it`, and `confirm` cannot add or replace food items.
- Repeated confirmations do not duplicate-save.
- No meal is saved without explicit confirmation.
- No OpenAI-only nutrition is marked verified.

## Binary Release Note

PR #40 does not change iOS source files. A new Codemagic/TestFlight binary is not required solely for this backend/OpenAI release, but the current TestFlight build must be smoke-tested against the production backend after Vercel production deploys.
