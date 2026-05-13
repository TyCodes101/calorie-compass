# Calorie Compass

Calorie Compass is a mobile-first AI-powered nutrition tracking app built with Next.js, TypeScript, Tailwind CSS, Prisma, SQLite, and the OpenAI API.

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
- SQLite
- OpenAI API

## Environment variables
Create a `.env` file in the project root:

```bash
DATABASE_URL="file:./dev.db"
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

## Demo user and sample meals
The seed script creates a demo user named **Tyler** with example entries like:
- Chipotle bowl
- protein shake
- eggs
- chicken and rice

## Useful commands
```bash
npm run test
npm run lint
npm run build
```

## Important note
Nutrition estimates are approximate and are not medical or dietary advice.
