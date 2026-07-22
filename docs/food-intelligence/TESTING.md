# Testing

## Deterministic layers

- Normalization, identity, modifiers, quantities, serving math, plausibility, and deduplication unit tests.
- Provider contract tests with mocked HTTP and sentinel credentials.
- Universal engine tests for chat/search parity, provider isolation, barcode, favorites, history, and source preservation.
- Pending-meal, conversation, save idempotency, failure, fuzz, and API tests.
- A permanent 1,000-case nutrition benchmark plus the protected golden dataset.
- Search regression cases for partials, spacing, typos, later-provider ranking, diagnostics, and OpenAI failure.
- Native Swift unit tests and a deterministic XCUITest search-review-save-history flow.

## Live checks

`npm run check:food-pipeline -- --live` is opt-in and network dependent. It proves credential and provider reachability but is not a replacement for deterministic contract tests. Preview smoke tests exercise the deployed normalized API contract.

Automated tests never consume production provider quota by default.
