# OpenAI Food Intelligence Layer

## Purpose

OpenAI is used as the food logger's intent parser, not as the nutrition database. The model interprets messy user language, extracts food identity, quantities, modifiers, commands, and ambiguity, then the existing resolver/provider/trusted catalog layer verifies or enriches nutrition before a pending meal review is shown.

The trust contract stays the same:

- Source-backed matches can be shown as verified or matched.
- Unsupported nutrition becomes a reviewable estimate.
- Ambiguous input asks clarification.
- Save still requires explicit confirmation through the pending meal state machine.
- Duplicate-save protection and idempotency stay in `/api/meals`.

## Server-Only Configuration

Required server environment variable:

```bash
OPENAI_API_KEY=sk-...
```

Optional server environment variables:

```bash
OPENAI_MEAL_MODEL=gpt-4.1-mini
OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS=4500
```

Set these only in backend/server environments such as Vercel project environment variables. Do not add `NEXT_PUBLIC_OPENAI_API_KEY`; the key must never be available to iOS, browser bundles, or Swift code.

The model name is centralized in `lib/ai/openaiConfig.ts`. Change the model there via `OPENAI_MEAL_MODEL` rather than scattering model names through the codebase.

## Runtime Flow

1. iOS sends a normal `/api/meal-assistant` request.
2. `runMealAssistant` calls `runOpenAIFoodIntelligence`.
3. OpenAI returns strict structured JSON for intent only.
4. `mapFoodIntelligenceToMealAssistantDecision` adapts that intent into the existing assistant decision shape.
5. Existing resolver/provider/catalog code verifies and hydrates nutrition.
6. Existing pending meal state machine creates or updates a review card.
7. `/api/meals` saves only after explicit confirmation and idempotency validation.

## Structured Schema

The schema is defined in `lib/ai/openaiFoodIntelligence.ts` as `foodIntelligenceResultSchema`. It contains:

- `action`
- `confidence`
- `ambiguity`
- `items`
- `userFacingMessage`

Item objects include raw text, normalized name, brand/restaurant, food type, quantity, modifiers, candidate queries, expected identity, and nutrition expectations. They do not include calories, macros, source metadata, trust labels, or save state.

## Fallback Behavior

The OpenAI wrapper returns safe failure reasons for:

- missing API key
- client-side/browser execution
- timeout
- rate limit
- generic OpenAI error
- empty output
- invalid JSON
- schema-invalid output
- unsafe output that tries to include nutrition or trust fields

When any of these occurs, `runMealAssistant` falls back to the existing deterministic classifier/resolver path. The app should never crash or auto-save because OpenAI failed.

## Tests

Mocked OpenAI tests:

```bash
vitest run tests/openai-food-intelligence.test.ts tests/openai-food-intelligence-security.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Full validation should also include:

```bash
prisma generate
eslint
next build
vitest run
```

## Optional Real OpenAI Smoke

The optional smoke script does not run in CI, does not save meals, and does not use the database:

```bash
node scripts/smoke-openai-food-intelligence.mjs
```

It requires `OPENAI_API_KEY` and prints each prompt's action, confidence, ambiguity, parsed items, candidate queries, and whether fallback would be needed.
