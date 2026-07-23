# Search Provider Flow

## Collection

1. Normalize the raw query without changing nutrition.
2. Search verified catalog, custom foods, favorites, and recent meals using raw and normalized identities.
3. Fan out to every configured provider with bounded query variants.
4. Keep each provider's normalized candidate set.
5. Ask OpenAI for aliases only when deterministic results do not establish a strong identity.
6. Search only newly introduced aliases in a second bounded pass.

Default server providers are USDA FoodData Central, Open Food Facts, FatSecret, Calorie API, and the optional commercial slot. Missing credentials disable only that provider.

FatSecret Basic clients use `foods/search/v1` and `food/v1`. Premier clients use v5. If a configured non-Basic scope is rejected with a safe scope error, MacroMesh retries OAuth once with `basic` and uses v1 search. Barcode lookup still requires the account's barcode entitlement.

## Selection

Candidates are validated before ranking. Deterministic ranking considers exact identity, leading prefix, compact identity, token coverage, brand or restaurant agreement, source strength, confidence, serving compatibility, favorites, and recency. Incomplete prefixes such as `Kit`, `Chip`, `Mc`, and `Sub` remain prefixes; they are not eagerly rewritten into unrelated generic categories.

Deduplication uses barcode first, then normalized brand or restaurant, food name, and serving. Conflicting nutrition is never blended. The strongest atomic record is selected and material disagreement triggers review.

The result cap is applied after deterministic ranking. This prevents a strong match returned later by a provider from being discarded before it can rank.

## Failure behavior

- Not configured: skip and continue.
- Unsupported operation: record and continue.
- No match: continue.
- Timeout, rate limit, invalid payload, or outage: isolate the provider and continue.
- OpenAI failure: retain deterministic provider candidates.
- No safe candidate: ask a clarification or return a clearly labeled reviewable estimate.
