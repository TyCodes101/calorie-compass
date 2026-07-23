# Provider Adapters

Providers implement `NutritionLookupProvider` from `lib/nutrition/types.ts`. Capabilities declare search, barcode, details, and suggestion support. Adapters return normalized `ParsedMealResponse` values; raw external payloads do not cross the provider boundary.

## Active adapters

- Local verified catalog: curated authoritative records.
- USDA FoodData Central: branded and generic foods.
- Open Food Facts: community product text and barcode data.
- FatSecret: Basic v1 or entitled Premier v5 search and details; barcode when entitled.
- Calorie API: authenticated search, barcode, and details.
- Commercial slot: optional Nutritionix-compatible provider.

Every network adapter validates JSON, uses fixed HTTPS origins, bounds query size and result count, enforces timeouts, retries only transient errors, caches normalized results, and maps failures to sanitized categories. Missing credentials disable only that provider.

Provider order is a source-quality tie-breaker, not an instruction to skip later configured sources during Food Search fan-out.
