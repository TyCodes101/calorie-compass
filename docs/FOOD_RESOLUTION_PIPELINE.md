# MacroMesh Food Resolution Pipeline

## Architecture

The production path is:

`iOS LogChatView` -> `POST /api/meal-assistant` -> validated request -> OpenAI structured intent -> item-by-item provider lookup -> identity and serving guardrails -> pending review card -> explicit `/api/meals` save.

OpenAI understands the request. It does not supply trusted calories or macros. Nutrition providers and the verified catalog supply nutrition; an AI estimate is the last fallback and remains visibly estimated.

## Active iOS Route

`ios/CalorieCompass/LogChatView.swift` calls `BackendService.sendMealAssistant`, which posts to `api/meal-assistant` using `AppConfig.current.backendBaseURL`. TestFlight uses the production URL in `AppConfig`; local overrides use the bundle or launch environment value `CALORIE_COMPASS_BASE_URL`.

The response contains the assistant decision, itemized meal, totals, confidence, and `next_state`. iOS renders each source/confidence label in the review card. Nothing is saved until the explicit save action calls `/api/meals` with the pending meal id/version and idempotency key.

## Environment

Copy `.env.example` to `.env.local` for local development. Next.js loads `.env.local` from the application root (`C:\Users\tyler\calorie-compass`). Keep it ignored and untracked.

Required for the primary AI path:

- `OPENAI_API_KEY` (server-only)
- `OPENAI_MEAL_MODEL` (optional; defaults to `gpt-4.1-mini`)
- `OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS` (optional; defaults to 4500 ms)

Provider configuration:

- `USDA_FDC_API_KEY` is canonical; `FDC_API_KEY` remains a compatibility alias.
- `NUTRITIONIX_APP_ID` and `NUTRITIONIX_API_KEY` are optional. Missing or partial credentials report `nutritionix_not_configured` and are not retried.
- `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET` are optional server-only credentials. `FATSECRET_SCOPE` defaults to `basic`; use `premier` or add `barcode` only when the account grants those entitlements. `FATSECRET_REGION` defaults to `US`.
- `CALORIE_API_KEY` is optional and server-only. A missing key disables only this provider. `CALORIE_API_ENABLED` defaults to true when a key is configured, and `CALORIE_API_TIMEOUT_MS` defaults to 3500 ms.
- Open Food Facts is enabled by default, requires no key, and uses a descriptive server-side user agent. Text and barcode candidates still pass the same identity, serving, and plausibility gates as every provider.
- UPC Database is disabled by default. When deliberately configured, it can recover barcode title/brand metadata only after every direct nutrition provider misses.
- `ALLOW_MOCK_MEAL_PARSER` defaults to false and is ignored in production. Tests set it explicitly through the test setup.
- `FOOD_PIPELINE_DEBUG` is development-only response tracing; production logs remain sanitized.

## Checker

Run from the repository root:

```bash
npm run check:food-pipeline
npm run check:food-pipeline -- --live
```

The default command only reports presence/configuration and never makes network calls. `--live` performs explicit health requests for configured providers. It never prints credential values or response bodies.

## Provider Priority and Labels

1. User-provided nutrition label or barcode.
2. Local verified catalog, including exact official restaurant and branded records.
3. USDA FoodData Central.
4. Open Food Facts community data for eligible packaged products.
5. FatSecret Platform when configured.
6. Calorie API when configured and its candidate passes identity, serving, and nutrition plausibility gates.
7. Configured commercial provider.
8. A cautious AI estimate only when no reliable provider match exists.

`Verified` is reserved for an exact authoritative record, `Matched` is used for strong database matches such as USDA, `Estimated` is used for AI or derived approximations, and `Needs Review` is used for ambiguity or identity/serving conflicts. An AI estimate can never become `Verified`.

## Failure Behavior and Mock Policy

OpenAI failures have typed reasons such as `missing_api_key`, `timeout`, `rate_limited`, `invalid_json`, or `unsafe_schema`. Provider failures are recorded as not configured, no match, or unavailable. If a reliable match is not possible, the user gets clarification or an explicitly reviewable estimate. Production never silently substitutes `getMockParsedMeal`.

The mock parser exists for deterministic unit tests and may be enabled locally only with `ALLOW_MOCK_MEAL_PARSER=true` outside production.

## Observability

Each meal-assistant request gets an `x-macromesh-request-id` response header. Sanitized server logs record route version, AI attempt/result/reason, provider attempts/results, selected provider, estimate/mock usage, clarification, and duration. Raw keys, authorization headers, and raw meal text are not logged. Development may opt into a `pipeline_debug` response field with the same sanitized trace.

## Vercel Checklist

Set provider credentials only in the intended Vercel environments and redeploy after changing them. Preview does not need production credentials unless live preview verification is intentional. The iOS binary contains no provider credentials.

See [NUTRITION_PROVIDER_INTEGRATION.md](./NUTRITION_PROVIDER_INTEGRATION.md) for endpoint, scope, cache, deployment, rotation, and rollback details.

## Manual TestFlight QA

Verify restaurant, branded, generic, modifier, typo, multi-item, correction, macro-question, review, repeated-save, save-failure, and stale-state cases. Confirm every item remains itemized, source labels are honest, review stays visible, and repeated confirmation does not create a duplicate history entry.

## Known Limitations

Homemade meals and unfamiliar foods can still require estimates or clarification. Provider freshness and restaurant coverage depend on available data sources; the pipeline prevents silent substitution but cannot guarantee perfect nutrition for every food.
