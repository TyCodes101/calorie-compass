# Provider Guide

The default text order is:

1. Local verified catalog and custom foods
2. Favorites and recent confirmed meals
3. USDA FoodData Central
4. Open Food Facts
5. FatSecret
6. Calorie API
7. Commercial provider slot
8. Reviewable estimate when no source-backed result is available

Configured providers are queried concurrently. Ordering affects deterministic tie-breaking, not whether a provider runs.

Providers implement `NutritionLookupProvider`. Search-capable providers may implement `searchCandidates` to return multiple normalized responses. Barcode and details capabilities remain explicit.

Provider adapters must validate external JSON, use bounded timeouts, protect credentials server-side, preserve provider serving metadata, and fail soft. Adding a provider requires normalization, plausibility, security, timeout, fallback, cache, and identity tests.
