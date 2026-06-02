# Release Checklist

This checklist prevents shipping or testing a TestFlight build against an outdated backend.

## Critical release fact

Codemagic/TestFlight uploads the native iOS app only. **A Codemagic/TestFlight upload does not deploy the backend.**

The current iOS TestFlight app calls the production backend URL:

```text
https://calorie-compass-chi.vercel.app
```

Before calling any TestFlight build ready, confirm the Vercel production backend is deployed from the same commit as the iOS build, or from a newer commit that contains the required backend fixes.

## Before marking TestFlight ready

1. Identify the iOS build commit from Codemagic.
2. Identify the backend deployment commit in Vercel production.
3. Confirm production is on either:
   - the exact same commit as the iOS build, or
   - a newer commit that includes the backend fixes needed by the iOS build.
4. Run the production backend verification script:

```bash
node scripts/verify-production-backend.mjs --expected-commit <ios-build-commit>
```

If the script reports a different or missing production commit, do not call the build ready until production is promoted and verified.

## Manual Vercel promotion steps

1. Open Vercel.
2. Go to `calorie-compass`.
3. Open **Deployments**.
4. Find the fixed deployment/commit.
5. Promote that deployment to **Production**.
6. Return to **Overview** and verify the production deployment commit changed to the intended commit.
7. Re-run:

```bash
node scripts/verify-production-backend.mjs --expected-commit <ios-build-commit>
```

## Required post-promotion production tests

After Vercel production is promoted, test the TestFlight app against production with:

- `a baked potato`
- `a skittles pack`
- `Quest BBQ protein chips`
- Save meal → confirm it appears in Today and History.

Do not mark the TestFlight build ready until these pass against `https://calorie-compass-chi.vercel.app`.
