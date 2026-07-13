# Decision: Do Not Integrate Spoonacular

**Status:** Accepted on July 13, 2026

## Context

MacroMesh needs nutrition records that can support a durable, user-confirmed meal history. The provider must also fit predictable latency, quota, caching, provenance, and commercial-use requirements.

Spoonacular's current free plan advertises 50 points per day and one request per second with no SLA. Its terms require attribution/backlinks, restrict storing acquired or derived data, allow caching only with prior permission and for a limited period, and require deletion when access ends.

## Decision

Do not add Spoonacular code, configuration, credentials, or a dormant provider adapter. The constraints conflict with the app's durable meal-history contract and would add a misleadingly available provider that production cannot safely depend on.

## Reconsider Only If

- Written commercial terms explicitly permit normalized durable user meal history.
- Cache and attribution requirements fit the product.
- Quota, latency, SLA, deletion, and incident behavior are acceptable.
- Security and licensing review approves the contract.

Official references: [pricing](https://spoonacular.com/food-api/pricing), [terms](https://spoonacular.com/food-api/terms), and [API documentation](https://spoonacular.com/food-api/docs).
