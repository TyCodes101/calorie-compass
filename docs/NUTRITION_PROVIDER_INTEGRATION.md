# Nutrition Provider Integration

## Repository Audit

MacroMesh uses Next.js App Router, TypeScript, Zod, Prisma/Postgres, Vitest, and a native SwiftUI client. The iOS app calls the MacroMesh backend only. The food path is structured meal understanding, item-by-item lookup, deterministic identity and nutrition validation, a reviewable pending meal, then an explicit idempotent save.

Before this integration, the provider order was local verified catalog, USDA, optional FatSecret, optional Nutritionix, then an explicitly labeled estimate. Open Food Facts handled barcode lookup separately. Provider responses normalize to `ParsedFoodItem`; `source_type` remains backward compatible while `provider_used`, `source_name`, candidate ID, confidence, and serving metadata retain provenance. No Prisma migration is required.

## Final Provider Architecture

Text lookup order:

1. User nutrition label, custom/recent/favorite data, and local verified catalog.
2. USDA FoodData Central.
3. Open Food Facts for explicit packaged products.
4. FatSecret.
5. Calorie API.
6. Nutritionix when configured.
7. Clarification or an explicit reviewable estimate.

Barcode lookup keeps local/custom matches first, then Open Food Facts, USDA, FatSecret, and Calorie API. If all direct nutrition providers miss, optional UPC Database metadata can drive exactly one secondary nutrition search. Exact barcodes remain strings and preserve leading zeroes. UPC Database metadata never supplies nutrition or replaces the selected nutrition provider's provenance.

Calorie API is intentionally a supporting provider. Its `is_verified` field does not bypass MacroMesh identity, serving, macro-calorie, numeric-safety, or outlier checks. A provider record is never automatically saved or promoted from `Matched` to `Verified` merely because the provider marks it verified.

## Official Endpoints

Calorie API:

- Base: `https://calorieapiadmin.com/api/v1`
- Search: `GET /search/foods`
- Barcode: `GET /search/barcode/{upc}`
- Details: `GET /foods/{food_id}`
- Authentication: server-side `X-API-Key`
- Requests use the documented server-side `X-API-Key` header. The account must have a plan that permits the intended production use.

FatSecret:

- OAuth token: `POST https://oauth.fatsecret.com/connect/token`
- Premier search: `GET https://platform.fatsecret.com/rest/foods/search/v5`
- Details: `GET https://platform.fatsecret.com/rest/food/v5`
- Barcode: `GET https://platform.fatsecret.com/rest/food/barcode/find-by-id/v2`
- Authentication: OAuth 2.0 client credentials, followed by a server-side Bearer token.

FatSecret food search and barcode access require the corresponding account scopes. Search uses the current v5 endpoint and hydrates only the selected provider record when a details fetch is needed. A Basic-only client cannot participate in text search; MacroMesh fails over to the remaining providers.

Open Food Facts:

- Product read: `GET https://world.openfoodfacts.org/api/v3/product/{code}`
- Narrow branded text search: official legacy `GET /cgi/search.pl` until a current full-text endpoint exists
- Authentication: none; a descriptive server-side `User-Agent` is sent

UPC Database:

- Metadata lookup: `GET https://api.upcdatabase.org/product/{barcode}`
- Authentication: optional server-side Bearer key
- Role: identity metadata rescue only, never nutrition

## Environment Variables

Local development values belong in ignored `.env.local`:

```dotenv
FATSECRET_CLIENT_ID=your_client_id_here
FATSECRET_CLIENT_SECRET=your_client_secret_here
FATSECRET_SCOPE=premier
FATSECRET_REGION=US
CALORIE_API_KEY=your_real_key_here
OPEN_FOOD_FACTS_ENABLED=true
OPEN_FOOD_FACTS_CONTACT=https://github.com/TyCodes101/calorie-compass
UPC_DATABASE_ENABLED=false
UPC_DATABASE_API_KEY=your_optional_key_here
```

Optional controls:

```dotenv
FATSECRET_ENABLED=true
FATSECRET_TIMEOUT_MS=3500
CALORIE_API_ENABLED=true
CALORIE_API_TIMEOUT_MS=3500
OPEN_FOOD_FACTS_TIMEOUT_MS=3000
UPC_DATABASE_TIMEOUT_MS=2500
```

`CALORIE_API_BASE_URL` is supported only for the official HTTPS origin and `/api/v1` path. Insecure or arbitrary origins disable the provider. Never use a `NEXT_PUBLIC_` prefix for either provider.

## Security Boundary

Provider credentials are read only in backend provider configuration. The iOS app receives normalized food data, never keys, OAuth credentials, authorization headers, or raw provider payloads. Provider URLs are constructed from fixed paths, detail IDs are character-limited, query lengths and result counts are bounded, and errors contain sanitized categories only.

Automated tests use sentinel credentials and mocked HTTP. CI does not consume production quota. `.env.local` remains ignored. Do not paste credentials into issues, pull requests, commits, logs, screenshots, documentation, or build settings that reach the client.

## Nutrition and Serving Contract

`requestedQuantity` and `requestedUnit` represent user intent. Provider serving amount/unit and optional gram weight describe the chosen provider record. The scale factor is computed once and final totals are recalculated from that result. A 55 g bar is not 55 bars, and one bar is not multiplied by its gram weight.

Per-100 g data is scaled as:

`final nutrient = nutrient per 100 g * serving grams / 100 * requested serving factor`

Intermediate values retain precision; normal response serialization performs the established final rounding. Unknown household-to-gram conversions are not invented.

## Validation and Fallback

External payloads are Zod validated. Invalid records are dropped individually so one corrupt result does not discard valid siblings. Rejected reasons include non-finite or negative nutrients, macro-calorie conflicts, invalid serving weights, incompatible serving units, identity conflicts, and broad nutrient outliers.

Requests use a 3.5 second default timeout, at most two bounded attempts, short jitter, and `Retry-After` when safe. Ordinary 400/401/402/403/404 and schema failures are not retried. A 404 barcode response is a normal miss. Provider failure continues to the next source.

## Cache and Quota Policy

Cache keys contain versioned SHA-256 digests, not raw queries or credentials. Identical in-flight requests are coalesced.

- Search: 15 minutes.
- Food details: 6 hours.
- Successful barcode: 6 hours.
- Confirmed barcode miss: 5 minutes.
- Open Food Facts product: 24 hours; packaged text search: 30 minutes.
- UPC Database metadata: 6 hours in memory; confirmed miss: 5 minutes.
- Timeout, rate limit, authorization, quota, server, and schema failures: never negative cached.

FatSecret nutrition caching stays below its documented 24-hour storage limit. Only top FatSecret search candidates are hydrated. Resolver aliases are capped and each provider stops after its first accepted query result.

## Vercel and CI

In Vercel Project Settings, create `FATSECRET_CLIENT_ID`, `FATSECRET_CLIENT_SECRET`, and `CALORIE_API_KEY` for each intentionally enabled environment. Use `FATSECRET_SCOPE=premier`; append `barcode` only when the account explicitly grants barcode access. Redeploy the affected environment after changes.

GitHub Actions and Codemagic use mocked provider tests and do not require live credentials. Only add encrypted CI credentials for an intentional protected live smoke workflow; never expose them to untrusted pull requests or echo them.

## Rotation

1. Generate a replacement credential in the provider dashboard.
2. Update the intended Vercel environment secrets.
3. Redeploy and run the live pipeline checker.
4. Verify search, barcode, review, save, and history behavior.
5. Revoke the old credential.

Rotation requires no source-code change.

## Rollback and Limitations

Set `OPEN_FOOD_FACTS_ENABLED=false`, `UPC_DATABASE_ENABLED=false`, `CALORIE_API_ENABLED=false`, or `FATSECRET_ENABLED=false` and redeploy to disable a provider immediately. A code rollback removes the adapters without a database rollback because this integration adds no migration and persists no provider secrets or raw payloads.

See [FREE_NUTRITION_PROVIDER_AUDIT.md](./FREE_NUTRITION_PROVIDER_AUDIT.md), [NUTRITION_DATA_LICENSING.md](./NUTRITION_DATA_LICENSING.md), and [SPOONACULAR_PROVIDER_DECISION.md](./SPOONACULAR_PROVIDER_DECISION.md).

Provider coverage, freshness, licensing, and restaurant modifier accuracy remain external constraints. FatSecret Premier/barcode features require paid scopes. Calorie API commercial use requires an eligible plan. Homemade meals and unsupported servings can still require clarification or a visible estimate. MacroMesh prevents silent substitution; it does not claim perfect nutrition accuracy.
