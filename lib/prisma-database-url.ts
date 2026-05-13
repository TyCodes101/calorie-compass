import path from 'node:path';

type EnvLike = {
  DATABASE_URL?: string;
  VERCEL?: string;
  [key: string]: string | undefined;
};

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function pointsToLocalDevDb(databaseUrl: string) {
  const normalized = databaseUrl.trim().replace(/\\/g, '/').toLowerCase();
  return normalized === 'file:./dev.db' || normalized.endsWith('/dev.db');
}

export function resolvePrismaDatabaseUrl(env: EnvLike = process.env, cwd = process.cwd()) {
  const configuredUrl = env.DATABASE_URL?.trim();

  if (!configuredUrl) {
    return configuredUrl;
  }

  if (env.VERCEL !== '1') {
    return configuredUrl;
  }

  if (!configuredUrl.startsWith('file:')) {
    return configuredUrl;
  }

  if (!pointsToLocalDevDb(configuredUrl)) {
    return configuredUrl;
  }

  return `file:${normalizePath(path.join(cwd, 'prisma', 'demo.db'))}`;
}
