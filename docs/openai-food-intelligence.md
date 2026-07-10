# OpenAI Food Intelligence Layer

## Product Contract

OpenAI is the food logger's language and intent layer. It is not the nutrition database, not the trust source, and not the save authority.

The app promise is:

- Understand messy food requests better.
- Preserve restaurant, brand, serving, quantity, and modifier identity.
- Verify or enrich nutrition through resolver, catalog, and provider layers.
- Show a reviewable pending meal before save.
- Require explicit confirmation before save.
- Fall back safely when OpenAI is missing, slow, malformed, ambiguous, or wrong.
- Never silently save the wrong food.

## Required Environment

Server-only required variable:

```bash
OPENAI_API_KEY=sk-...
```

Optional server variables:

```bash
OPENAI_MEAL_MODEL=gpt-4.1-mini
OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS=4500
```

Do not put OpenAI keys in iOS, browser JavaScript, public Next config, analytics, client logs, or screenshots.

## Vercel Setup

Set `OPENAI_API_KEY` in Vercel Project Settings -> Environment Variables for the target environment. Add `OPENAI_MEAL_MODEL` only when intentionally overriding the default model.

After changing env vars, redeploy the target branch or production deployment. The iOS app still calls only the backend; no TestFlight build should contain an OpenAI key.

## Local Setup

For normal tests, no OpenAI key is required because tests explicitly inject the deterministic fixture policy. Production does not silently fall back to mock results when the key is absent.

For a real smoke run:

```bash
node scripts/smoke-openai-food-intelligence.mjs
```

The script requires `OPENAI_API_KEY` in the shell environment. It does not save meals, call `/api/meals`, use Prisma, or mutate state.

## Runtime Flow

1. iOS sends a normal `/api/meal-assistant` request.
2. `runMealAssistant` calls `runOpenAIFoodIntelligence`.
3. OpenAI returns strict JSON for intent and identity only.
4. `mapFoodIntelligenceToMealAssistantDecision` adapts that output to the existing assistant decision shape.
5. Existing resolver, catalog, and provider code verify or estimate nutrition.
6. The pending meal state machine creates or updates the review card.
7. `/api/meals` saves only after explicit confirmation and idempotency validation.

## What OpenAI May Decide

OpenAI may provide:

- User action intent.
- Candidate food search queries.
- Restaurant or brand identity hints.
- Canonical item hints.
- Quantity and serving text.
- Modifier hints such as no cheese, footlong, double meat, no bun, or one can.
- Ambiguity and a clarification question.

## What OpenAI May Not Decide

OpenAI may not provide or override:

- Final calories or macros.
- Source type.
- Trust labels such as Verified or Matched.
- `is_trusted`.
- Provider facts.
- Saved state.
- Idempotency keys.
- Review bypasses.
- Direct writes to meal history.

If OpenAI output includes nutrition fields, trust fields, prompt-injection text, fake verification claims, exact nutrition claims in user-facing text, invalid enums, missing required fields, oversized arrays, or overly long strings, the wrapper rejects it and the app falls back safely.

## Structured Schema

The schema lives in `lib/ai/openaiFoodIntelligence.ts` as `foodIntelligenceResultSchema`.

Top-level fields:

- `action`
- `confidence`
- `ambiguity`
- `items`
- `userFacingMessage`

Each item includes:

- `rawText`
- `normalizedName`
- `brandOrRestaurant`
- `foodType`
- `quantity`
- `modifiers`
- `candidateQueries`
- `expectedIdentity`
- `nutritionExpectation`

The schema is strict, bounded, and mirrored in the OpenAI `json_schema` response format. Unknown properties and unsafe nutrition/trust fields are rejected.

## Fallback Behavior

The wrapper returns safe failure reasons for:

- Missing API key.
- Client/browser execution.
- Timeout.
- Rate limit.
- OpenAI or network error.
- Empty output.
- Invalid JSON.
- Schema-invalid output.
- Unsafe output.

`runMealAssistant` records the typed failure and uses only safe provider/clarification behavior. A deterministic fixture is available only to tests or when `ALLOW_MOCK_MEAL_PARSER=true` outside production. The failure object contains only a safe reason and never returns raw OpenAI errors, prompts, keys, or model internals to the client.

## Security Tests

Mocked OpenAI and security boundary tests:

```bash
vitest run tests/openai-food-intelligence.test.ts tests/openai-food-intelligence-security.test.ts tests/food-logging-api-failure-modes.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

The tests cover:

- No public OpenAI env names.
- No real-looking committed OpenAI keys.
- No OpenAI SDK usage in browser/client code.
- No Swift/iOS OpenAI calls.
- No OpenAI env exposure through Next config.
- No raw OpenAI error, prompt, or key leakage from API failures.
- Strict schema bounds and invalid enum rejection.
- Prompt-injection and fake-trust output rejection.
- Non-mutating actions cannot smuggle food items into saves.

## Validation Commands

Recommended full validation:

```bash
prisma generate
eslint
next build
vitest run
node --check scripts/smoke-openai-food-intelligence.mjs
```

Focused suites:

```bash
vitest run tests/meal-assistant-runner.test.ts tests/meal-assistant-conversation.test.ts tests/meal-chat-state-machine.test.ts tests/meal-state-invariants.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
vitest run tests/food-world-gauntlet.test.ts tests/food-conversation-fuzz.test.ts tests/food-trust-hardening-scenarios.test.ts tests/restaurant-log-regression.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
vitest run tests/nutrition.test.ts tests/nutrition-resolver-provider-failure-modes.test.ts tests/nutrition-lookup.test.ts tests/nutrition-ranking.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
vitest run tests/meals-idempotency.test.ts tests/food-logging-api-failure-modes.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

## Real Smoke Script

Run only when a real key is available:

```bash
node scripts/smoke-openai-food-intelligence.mjs
```

The script checks 30 to 50 representative prompts, prints concise structured summaries, redacts key-like strings, flags ambiguity, flags low confidence, flags missing candidate queries, and exits nonzero only for schema, JSON, or system failures.

## TestFlight Checklist

Use a production-backed TestFlight build and verify each case stays review-before-save:

- Wendy's Baconator.
- Wendy's Baconnator typo.
- McDouble no cheese.
- McDonald's McDouble without cheese.
- Subway meatball footlong.
- Chipotle chicken bowl.
- Arby's roast beef.
- Diet Coke.
- hot cheeots.
- 2 grilled chicken breasts and asparagus.
- buttered corn on the cob.
- breakfast sandwich should clarify or create a clearly reviewable estimate.
- bowl should clarify or create a clearly reviewable estimate.
- chicken sandwich should clarify instead of picking a random restaurant.
- where's my macros after a pending meal.
- yes after a pending meal saves once.
- repeated yes does not duplicate-save.
- save it after a pending meal saves once.
- repeated save it does not duplicate-save.
- add McDouble no cheese updates the current pending meal.
- replace with McDouble no cheese replaces the pending meal.
- nvm discards or safely keeps state as designed.
- undo does not create or save a hidden meal.
- start over clears stale pending state.

## Remaining Manual Risk

Automated tests prove the trust boundary and fallback behavior. Real TestFlight QA still needs to confirm production latency, App Store/TestFlight configuration, Vercel env vars, source labels in the native review card, keyboard layout, repeated tap behavior, and production provider availability.
