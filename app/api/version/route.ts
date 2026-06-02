import { NextResponse } from 'next/server';

const deployedAt = process.env.VERCEL_GIT_COMMIT_SHA ? null : process.env.BUILD_TIME ?? null;

export async function GET() {
  const vercelUrl = process.env.VERCEL_URL?.trim() || null;

  return NextResponse.json({
    app: 'calorie-compass',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    provider: process.env.VERCEL ? 'vercel' : 'unknown',
    git: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? null,
    },
    deployment: {
      url: vercelUrl ? `https://${vercelUrl}` : null,
      deployedAt,
    },
  });
}
