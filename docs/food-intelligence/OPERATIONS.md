# Operations

## Configuration

Provider credentials belong in ignored `.env.local` for local work and encrypted Vercel environment variables for deployed environments. A secret change requires redeploying the affected environment. Preview and production values are independent.

## Health checks

```bash
npm run check:food-pipeline
npm run check:food-pipeline -- --live
```

Use the first command for safe configuration status and the second for explicit network checks. Use `FOOD_SEARCH_DEBUG=1` only locally when inspecting one search request.

## Immediate rollback

Disable a failing external source with its server-side enabled flag and redeploy. Open Food Facts, FatSecret, Calorie API, UPC Database, and the commercial provider can fail independently without disabling the verified catalog or review flow.

For a code rollback, revert the Food Intelligence commit and redeploy. No migration is introduced by the current search changes. Do not merge or promote a release while critical CI, preview smoke, or TestFlight checks are red.
