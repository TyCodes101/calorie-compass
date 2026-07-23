# Target Architecture

The active architecture already uses one engine and one normalized review contract. Future work should strengthen that system without introducing a parallel resolver.

## Next increments

1. Persist privacy-safe correction events for user-specific ranking.
2. Move the legacy web parser's multi-item hydration behind the same Food Intelligence orchestration contract, then retire the compatibility path after parity testing.
3. Add calibrated identity, serving, nutrition, and modifier confidence dimensions.
4. Move in-process search caches to a shared cache when traffic justifies it.
5. Add persistent provider health and circuit-breaker state.
6. Expand locale-aware brand licensing and restaurant availability signals.
7. Add opt-in live provider metrics without making deterministic CI depend on external uptime.

Each increment must preserve source provenance, review-before-save, save idempotency, backward-compatible iOS decoding, and fail-soft provider isolation.
