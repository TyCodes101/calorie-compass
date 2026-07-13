# Nutrition Data Licensing and Retention

This document records the engineering policy applied to provider data. Product ownership should obtain legal review before commercial launch or materially different reuse.

## Durable Records

MacroMesh saves only the normalized nutrition values and provenance needed for the user-confirmed meal history. It does not persist provider credentials, authorization headers, or raw external payloads. Legacy Open Food Facts cache rows are ignored because the previous implementation could represent per-100g values as a serving.

## Provider Policy

- **USDA FoodData Central:** public-domain/CC0 data may be normalized and stored. Keep `USDA FoodData Central` as provenance.
- **Open Food Facts:** attribute the community database in source metadata. Use only normalized in-memory product/search caching in this integration. Do not ingest or redistribute images. Durable bulk reuse or a derived product database needs an ODbL review.
- **UPC Database:** metadata is ephemeral identity assistance. Do not use it as nutrition, do not expose raw responses, and do not durably cache it as a product catalog. A successful lookup is cached in memory for six hours; a confirmed miss for five minutes.
- **Spoonacular:** not integrated because its storage, cache-permission, deletion, backlink, quota, and SLA constraints do not fit durable user meal history.
- **FatSecret and Calorie API:** continue following their account plan and integration documentation. The server stores normalized user-confirmed meal history, not raw provider payloads or credentials.

## Attribution

User-visible source names remain plain and truthful: `USDA FoodData Central`, `Open Food Facts community database`, `FatSecret Platform`, or `Calorie API database`. `Verified` is not inferred from a provider name. Community and ambiguous records remain `Matched` or `Needs Review`.

## Retention and Cache Rules

- Cache keys are versioned SHA-256 digests and contain no credentials.
- Authorization, quota, rate-limit, timeout, server, and schema errors are never cached as food misses.
- Confirmed 404 barcode misses may be cached for five minutes.
- Open Food Facts product reads cache normalized records for 24 hours; text search for 30 minutes.
- UPC Database metadata is never nutrition provenance and never creates a food without a separate accepted nutrition provider.

## Owner Actions

Before production commercialization, confirm provider plan eligibility and obtain counsel for ODbL attribution/derived-database obligations and UPC Database reuse. Rotate any credential disclosed outside the intended secret manager.
