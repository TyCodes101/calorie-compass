# Calorie Compass

Calorie Compass is a mobile-first AI-powered nutrition tracking app built with Next.js, TypeScript, Tailwind CSS, Prisma, Postgres, and the OpenAI API.

## Current MVP
This first build focuses on the core loop:
- onboarding
- dashboard
- AI meal logger
- confirmation/edit before save

## Tech stack
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Prisma
- Postgres
- OpenAI API

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

## Local setup
```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Open the local URL shown by Next.js.

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
```

Before deploy, run the full guard:

```bash
npm run predeploy:check
```

`npm run qa:assistant` runs the golden multi-turn chatbot QA suite. It checks logging accuracy, correction behavior, nutrition questions, recommendations, repeat-meal memory, active meal preservation, dead-end replies, unrelated food drift, and common nutrition sanity ranges.

## Important note
Nutrition estimates are approximate and are not medical or dietary advice.
