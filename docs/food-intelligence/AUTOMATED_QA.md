# Automated QA Guide

## Local gates

```bash
npm run scan:secrets
npm run lint
npm run test:food-intelligence
npm run test:food-search
npm run test:release-food
npm test
npm run build
```

Provider tests use mocks and sanitized fixtures. CI must not consume production nutrition or OpenAI quota.

## iOS gates

The shared `CalorieCompass` scheme contains unit tests and `CalorieCompassUITests`. UI tests use `scripts/food-intelligence-ui-mock-server.mjs` and exercise live search, review, save, and history without production dependencies.

## CI

- `Food Intelligence CI` runs secret scanning, lint, all Vitest tests, named food release gates, and a production build.
- `iOS CI` starts the deterministic backend and runs unit plus UI tests on a simulator.
- `Preview Food Smoke` checks five representative queries after a successful preview deployment.
- Codemagic repeats all critical web, nutrition, native, and UI gates before signing.

Any failing critical gate blocks upload.
