# Food Intelligence Rollback Guide

The implementation is additive and has no database migration.

## Preferred rollback

1. Stop TestFlight promotion or production promotion.
2. Redeploy the last known-good commit.
3. Disable a failing external provider by removing its server credential or provider-specific enable flag.
4. Preserve pending meals and saved history; do not delete user records.
5. Run the preview smoke script against the rollback deployment.

## Partial containment

A provider outage should require no code rollback because provider calls fail soft. If ranking is the problem, disable optional LLM ranking while retaining deterministic provider results. If iOS live search is affected, the explicit Search button remains the fallback after debounce cancellation.

Rollback does not require rotating provider keys unless a credential was exposed. A committed credential must be revoked even after the commit is reverted.
