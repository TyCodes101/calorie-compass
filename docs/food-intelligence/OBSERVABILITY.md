# Observability

Development search diagnostics are enabled with `FOOD_SEARCH_DEBUG=1` outside production. They record normalized variants, provider configuration, attempts, outcome, candidate counts, duration, typed HTTP failure status when available, rejected count, final count, and winning identity.

Meal assistant traces use request IDs and sanitized provider stages. Provider health is available through `npm run check:food-pipeline` and the opt-in `-- --live` mode.

Never record API keys, OAuth tokens, authorization headers, raw provider bodies, email addresses, authentication tokens, complete meal histories, or unrestricted raw prompts. Successful adapter calls do not invent an HTTP status when the low-level status is unavailable.

Production API responses never include `pipeline_debug`.
