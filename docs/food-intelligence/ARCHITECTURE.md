# Food Intelligence Architecture

MacroMesh has one server-side discovery contract for chat, search, barcode, favorites, history, suggestions, and future voice input.

```mermaid
flowchart TD
  A[User input] --> B[Normalize and extract intent]
  B --> C[Food Intelligence Engine]
  C --> D[Custom foods and verified catalog]
  C --> E[Favorites and history]
  C --> F[Enabled nutrition providers]
  D --> G[Normalized candidates]
  E --> G
  F --> G
  G --> H[Identity validation and deduplication]
  H --> I[Deterministic ranking]
  I --> J[Optional LLM reorder only]
  J --> K[Confidence and review requirement]
  K --> L[Review card]
  L --> M[Explicit save with idempotency]
```

## Ownership

- OpenAI extracts intent, components, aliases, and modifiers. It does not author trusted nutrition.
- Providers own nutrition records and serving metadata.
- `lib/food-intelligence/engine.ts` owns entry-point parity and normalized results.
- `lib/food-search.ts` owns candidate collection, deduplication, deterministic ranking, and review metadata.
- Pending meal state owns review and save-once behavior.

## Invariants

- Raw provider payloads never reach iOS.
- Provider nutrition and serving fields stay atomic; records are never blended.
- LLM ranking cannot alter nutrition, source, confidence, or candidate IDs.
- Provider failure is isolated and cannot block healthy providers.
- AI estimates are last-resort, labeled estimates, and always reviewable.
- Favorites, recents, and suggestions are refreshed into review state and never auto-saved.
