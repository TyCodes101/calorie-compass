import { Prisma } from '@prisma/client';

type SaveKind = 'meal' | 'favorite' | 'profile';

type EnvLike = Partial<Record<'DATABASE_URL' | 'DATABASE_URL_UNPOOLED' | 'VERCEL', string>>;

type LogDetails = Record<string, unknown>;

function redactConnectionUrl(connectionUrl: string | undefined) {
  if (!connectionUrl) {
    return {
      provider: 'unknown',
      host: null,
      database: null,
      pooled: false,
    };
  }

  if (connectionUrl.startsWith('file:')) {
    return {
      provider: 'sqlite',
      host: 'local-file',
      database: connectionUrl.replace(/^file:/, ''),
      pooled: false,
    };
  }

  try {
    const parsed = new URL(connectionUrl);
    return {
      provider: parsed.protocol.replace(':', '') || 'unknown',
      host: parsed.hostname || null,
      database: parsed.pathname.replace(/^\//, '') || null,
      pooled: parsed.searchParams.has('pgbouncer') || parsed.hostname.includes('pooler') || parsed.hostname.includes('-pooler'),
    };
  } catch {
    return {
      provider: 'unknown',
      host: 'unparseable',
      database: null,
      pooled: false,
    };
  }
}

export function getDatabaseDebugInfo(env: EnvLike = process.env as EnvLike) {
  const runtimeUrl = env.DATABASE_URL?.trim();
  const directUrl = env.DATABASE_URL_UNPOOLED?.trim();

  return {
    runtime: env.VERCEL === '1' ? 'vercel' : 'local',
    runtimeConnection: redactConnectionUrl(runtimeUrl),
    directConnection: redactConnectionUrl(directUrl),
  };
}

export function getPersistenceErrorMessage(kind: SaveKind) {
  switch (kind) {
    case 'favorite':
      return 'We couldn’t save your favorite right now. Please try again.';
    case 'profile':
      return 'We couldn’t save your profile right now. Please try again.';
    case 'meal':
    default:
      return 'We couldn’t save your meal right now. Please try again.';
  }
}

export function logWriteStart(action: string, details: LogDetails = {}) {
  console.info(`[db] ${action}.start`, {
    ...getDatabaseDebugInfo(),
    ...details,
  });
}

export function logWriteSuccess(action: string, details: LogDetails = {}) {
  console.info(`[db] ${action}.success`, details);
}

export function logConnectionReady(action: string, details: LogDetails = {}) {
  console.info(`[db] ${action}.connected`, {
    ...getDatabaseDebugInfo(),
    ...details,
  });
}

export function logWriteFailure(action: string, error: unknown, details: LogDetails = {}) {
  console.error(`[db] ${action}.failure`, {
    ...getDatabaseDebugInfo(),
    ...details,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message : String(error),
    prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
  });
}

export function isDatabaseWriteError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    message.includes('readonly database') ||
    message.includes('database') ||
    message.includes('connectorerror')
  );
}
