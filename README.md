# Calorie Compass

Calorie Compass is a mobile-first AI-powered nutrition tracking app.

- **Web (production):** https://calorie-compass-chi.vercel.app
- **Repo:** https://github.com/TyCodes101/calorie-compass

## What it does
- Onboarding + profile setup
- Dashboard + macro tracking
- AI meal logger (confirmation/edit before save)
- History + progress views

## Monorepo layout
- `app/` — Next.js app router (web)
- `ios/` — native iOS SwiftUI app (Xcode project under `ios/CalorieCompass`)
- `tests/` — web + backend tests (Vitest)

## Tech stack
- Next.js App Router + React + TypeScript + Tailwind
- Prisma + Postgres
- OpenAI API (optional in local dev)
- Native iOS: SwiftUI

## Environment variables
Create a `.env` file in the project root:

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:password@host:5432/database?sslmode=require"
OPENAI_API_KEY="your_openai_api_key"
```

Optional:

```bash
OPENAI_MEAL_MODEL="gpt-4.1-mini"
```

## Local setup (web)
```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

## Demo behavior
- If `OPENAI_API_KEY` is present, the meal parsing route calls OpenAI.
- If `OPENAI_API_KEY` is missing, the app falls back to a deterministic demo parser for local development.
- Production persistence expects a writable Postgres database. Bundled SQLite files are not suitable for serverless writes.

## Demo user and sample meals
The seed script creates a demo user named **Tyler** with example entries like:
- Chipotle bowl
- protein shake
- eggs
- chicken and rice

## Useful commands
```bash
npm test
npm run lint
npm run build
npm run qa:assistant
npm run test:food-intelligence
npm run test:food-search
npm run scan:secrets
```

Before deploy:
```bash
npm run predeploy:check
```

`npm run qa:assistant` runs the golden multi-turn chatbot QA suite.

## iOS
- Xcode project: `ios/CalorieCompass/CalorieCompass.xcodeproj`
- iOS app display name is currently **MacroMesh**.

## Docs
- `docs/TESTFLIGHT_UPDATE_WORKFLOW.md`
- `docs/RELEASE_CHECKLIST.md`

The universal discovery architecture and release gates are documented in [`docs/food-intelligence/ARCHITECTURE.md`](docs/food-intelligence/ARCHITECTURE.md).

## Important note
Nutrition estimates are approximate and are not medical or dietary advice.
