# Search Debugging

## Local diagnostics

Set this only in local development:

```dotenv
FOOD_SEARCH_DEBUG=1
```

Then call:

```text
GET /api/food-search?q=Kit
```

Outside production, the response includes `pipeline_debug` with normalized query variants, provider configuration and attempt outcomes, candidate counts, duration, sanitized provider error category, final count, and winning candidate. `httpStatus` is populated only when a typed provider error contains a real HTTP status. It is not invented for successful adapter calls.

Production never returns `pipeline_debug`, even if `FOOD_SEARCH_DEBUG=1` is accidentally configured.

## Provider health

Run:

```bash
npm run check:food-pipeline
npm run check:food-pipeline -- --live
```

The default mode checks configuration only. Live mode performs bounded health requests. Neither mode prints keys, authorization headers, or full provider bodies.

## Release diagnosis

1. Confirm which URL the client binary uses.
2. Call that exact `/api/food-search` route directly.
3. Compare production, preview, and local results.
4. Enable local diagnostics and inspect provider attempts.
5. Verify provider account scope separately from code configuration.
6. Run `npm run test:food-search`, `npm run test:food-intelligence`, and the full suite.

Do not debug TestFlight against a preview deployment unless the binary was intentionally compiled with that preview base URL.
