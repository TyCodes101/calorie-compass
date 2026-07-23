# Developer Guide

## Entry points

- Text: `searchFoodIntelligence`
- Single chat item: `resolveFoodIntelligenceItem`
- Barcode: `lookupBarcodeFoodIntelligence`
- Saved food refresh: `revalidateFoodIntelligenceItems`

Do not call a provider directly from an API route, Swift code, or a new feature. Add an engine mode or a thin adapter instead.

## Adding behavior

1. Add identity normalization only when it generalizes safely.
2. Keep nutrition in providers or the curated catalog.
3. Preserve explicit quantity, unit, brand, restaurant, and modifiers.
4. Return review metadata for ambiguity or conflicts.
5. Add a permanent regression fixture.
6. Run all release gates.

Secrets remain in server environment variables. iOS receives only normalized source labels and food models.
