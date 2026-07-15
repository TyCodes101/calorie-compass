# Search Engine Guide

`searchFoodIntelligence` is the supported text-search entry point. The food-search API, chat hydration, favorites, history, and suggestions call this engine directly or through a thin adapter.

## Query flow

1. Normalize quantities, units, brands, restaurants, preparation, and high-confidence typos.
2. Search local user data and the verified catalog.
3. Fan out concurrently to every configured provider.
4. Normalize candidate sets into `FoodSearchResult`.
5. Deduplicate by barcode or normalized brand, name, and serving.
6. Detect material nutrition conflicts.
7. Rank deterministically, then optionally allow an LLM to reorder IDs only.
8. return up to ten reviewable candidates.

The iOS search sheet debounces input by 300 ms, cancels stale URL tasks, and ignores late responses using request IDs.

High-confidence typo normalization is intentionally small and identity-only. It never contains nutrition values.
