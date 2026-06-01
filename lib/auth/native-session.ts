import { createHash, randomBytes } from 'crypto';

import type { ActivityLevel, GoalType } from '@prisma/client';

import type { VerifiedAppleIdentity } from '@/lib/auth/apple-token-verification';
import { prisma } from '@/lib/prisma';
import { defaultProfileSettings } from '@/lib/profile-settings';

const nativeAuthProvider = 'apple';
const nativeSessionTokenBytes = 32;
export const nativeSessionTtlMs = 1000 * 60 * 60 * 24 * 30;

type NativeSessionTransaction = {
  user: {
    create: (args: unknown) => Promise<SessionUserPayload>;
  };
  userAuthProvider: {
    upsert: (args: unknown) => Promise<{
      userId: string;
      user: SessionUserPayload;
    }>;
  };
  nativeSession: {
    create: (args: unknown) => Promise<unknown>;
  };
};

type NativeSessionPrisma = {
  $transaction: <T>(callback: (tx: NativeSessionTransaction) => Promise<T>) => Promise<T>;
  nativeSession: NativeSessionDelegate;
};

type NativeSessionUserPayload = SessionUserPayload & {
  createdAt: Date;
  updatedAt: Date;
  profile: {
    id: string;
    userId: string;
    age: number | null;
    heightCm: number | null;
    weightLbs: number | null;
    goal: GoalType;
    activityLevel: ActivityLevel;
    dailyCalorieGoal: number;
    proteinGoal: number;
    aiPreferenceNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

type NativeSessionRecord = {
  id: string;
  userId?: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user?: NativeSessionUserPayload;
};

type NativeSessionDelegate = {
  findUnique: (args: unknown) => Promise<NativeSessionRecord | null>;
  update: (args: unknown) => Promise<unknown>;
};

const nativeSessionPrisma = prisma as unknown as NativeSessionPrisma;

type SessionUserPayload = {
  id: string;
  name: string;
  email: string | null;
  demo: boolean;
};

export type IssuedNativeSession = {
  token: string;
  expiresAt: Date;
  user: SessionUserPayload;
  provider: typeof nativeAuthProvider;
  providerSubject: string;
};

export type IssuedNativeGuestSession = {
  token: string;
  expiresAt: Date;
  user: SessionUserPayload;
};

export type RevokeNativeSessionResult =
  | { revoked: true; reason: 'revoked' | 'expired' }
  | { revoked: false; reason: 'missing_token' | 'persistence_unavailable' | 'not_found' | 'already_revoked' };

export type NativeAccountSession =
  | {
      ok: true;
      token: string;
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
        revokedAt: null;
      };
      user: NativeSessionUserPayload | null;
    }
  | {
      ok: false;
      status: 401 | 503;
      code:
        | 'NATIVE_SESSION_REQUIRED'
        | 'NATIVE_SESSION_REVOKED'
        | 'NATIVE_SESSION_EXPIRED'
        | 'NATIVE_SESSION_PERSISTENCE_UNAVAILABLE';
      error: string;
    };

export function hasNativeSessionPersistence(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.DATABASE_URL?.trim());
}

export function generateNativeSessionToken() {
  return randomBytes(nativeSessionTokenBytes).toString('base64url');
}

export function hashNativeSessionToken(token: string) {
  return `sha256:${createHash('sha256').update(token).digest('hex')}`;
}

export function getNativeSessionExpiresAt(now = new Date()) {
  return new Date(now.getTime() + nativeSessionTtlMs);
}

export function isNativeSessionExpired(session: { expiresAt: Date }, now = new Date()) {
  return session.expiresAt.getTime() <= now.getTime();
}

function verifiedEmailFromAppleIdentity(identity: VerifiedAppleIdentity) {
  return identity.email && identity.emailVerified ? identity.email : null;
}

export async function issueNativeSessionForAppleIdentity({
  identity,
  now = new Date(),
  tokenFactory = generateNativeSessionToken,
  client = nativeSessionPrisma,
}: {
  identity: VerifiedAppleIdentity;
  now?: Date;
  tokenFactory?: () => string;
  client?: NativeSessionPrisma;
}): Promise<IssuedNativeSession> {
  const token = tokenFactory();
  const tokenHash = hashNativeSessionToken(token);
  const expiresAt = getNativeSessionExpiresAt(now);
  const verifiedEmail = verifiedEmailFromAppleIdentity(identity);

  const result = await client.$transaction(async (tx) => {
    const providerLink = await tx.userAuthProvider.upsert({
      where: {
        provider_providerSubject: {
          provider: nativeAuthProvider,
          providerSubject: identity.subject,
        },
      },
      create: {
        provider: nativeAuthProvider,
        providerSubject: identity.subject,
        email: verifiedEmail,
        emailVerified: identity.emailVerified,
        user: {
          create: {
            name: 'Apple User',
            demo: false,
          },
        },
      },
      update: {
        email: verifiedEmail,
        emailVerified: identity.emailVerified,
      },
      include: {
        user: true,
      },
    });

    await tx.nativeSession.create({
      data: {
        userId: providerLink.userId,
        tokenHash,
        expiresAt,
      },
    });

    return providerLink;
  });

  return {
    token,
    expiresAt,
    provider: nativeAuthProvider,
    providerSubject: identity.subject,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      demo: result.user.demo,
    },
  };
}

export async function issueNativeGuestSession({
  now = new Date(),
  tokenFactory = generateNativeSessionToken,
  client = nativeSessionPrisma,
}: {
  now?: Date;
  tokenFactory?: () => string;
  client?: NativeSessionPrisma;
} = {}): Promise<IssuedNativeGuestSession> {
  const token = tokenFactory();
  const tokenHash = hashNativeSessionToken(token);
  const expiresAt = getNativeSessionExpiresAt(now);

  const user = await client.$transaction(async (tx) => {
    const guest = await tx.user.create({
      data: {
        name: 'Guest',
        demo: true,
        profile: {
          create: {
            age: defaultProfileSettings.age ?? null,
            heightCm: defaultProfileSettings.heightCm ?? null,
            weightLbs: defaultProfileSettings.weightLbs ?? null,
            goal: defaultProfileSettings.goal,
            activityLevel: defaultProfileSettings.activityLevel,
            dailyCalorieGoal: defaultProfileSettings.dailyCalorieGoal,
            proteinGoal: defaultProfileSettings.proteinGoal,
            aiPreferenceNotes: defaultProfileSettings.nutritionPreferences ?? null,
          },
        },
      },
    });

    await tx.nativeSession.create({
      data: {
        userId: guest.id,
        tokenHash,
        expiresAt,
      },
    });

    return guest;
  });

  return { token, expiresAt, user };
}

export async function getUserForNativeSessionToken(
  token: string | null | undefined,
  { now = new Date(), client = nativeSessionPrisma }: { now?: Date; client?: Pick<NativeSessionPrisma, 'nativeSession'> } = {},
) {
  const trimmedToken = token?.trim();
  if (!trimmedToken || !hasNativeSessionPersistence()) {
    return null;
  }

  const session = await client.nativeSession.findUnique({
    where: { tokenHash: hashNativeSessionToken(trimmedToken) },
    include: { user: { include: { profile: true } } },
  });

  if (!session || session.revokedAt || isNativeSessionExpired(session, now)) {
    return null;
  }

  return session.user;
}

export async function revokeNativeSessionToken(
  token: string | null | undefined,
  { now = new Date(), client = nativeSessionPrisma }: { now?: Date; client?: Pick<NativeSessionPrisma, 'nativeSession'> } = {},
): Promise<RevokeNativeSessionResult> {
  const trimmedToken = token?.trim();
  if (!trimmedToken) {
    return { revoked: false, reason: 'missing_token' };
  }

  if (!hasNativeSessionPersistence()) {
    return { revoked: false, reason: 'persistence_unavailable' };
  }

  const session = await client.nativeSession.findUnique({
    where: { tokenHash: hashNativeSessionToken(trimmedToken) },
    select: { id: true, expiresAt: true, revokedAt: true },
  });

  if (!session) {
    return { revoked: false, reason: 'not_found' };
  }

  if (session.revokedAt) {
    return { revoked: false, reason: 'already_revoked' };
  }

  await client.nativeSession.update({
    where: { id: session.id },
    data: { revokedAt: now },
  });

  return { revoked: true, reason: isNativeSessionExpired(session, now) ? 'expired' : 'revoked' };
}

export async function getNativeAccountSessionFromRequest(
  request: Request,
  { now = new Date(), client = nativeSessionPrisma }: { now?: Date; client?: Pick<NativeSessionPrisma, 'nativeSession'> } = {},
): Promise<NativeAccountSession> {
  const token = await readNativeSessionTokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'NATIVE_SESSION_REQUIRED',
      error: 'A signed-in native account session is required for this request.',
    };
  }

  if (!hasNativeSessionPersistence()) {
    return {
      ok: false,
      status: 503,
      code: 'NATIVE_SESSION_PERSISTENCE_UNAVAILABLE',
      error: 'Durable database persistence is required for native account sessions.',
    };
  }

  const session = await client.nativeSession.findUnique({
    where: { tokenHash: hashNativeSessionToken(token) },
    include: { user: { include: { profile: true } } },
  });

  if (!session) {
    return {
      ok: false,
      status: 401,
      code: 'NATIVE_SESSION_REQUIRED',
      error: 'A signed-in native account session is required for this request.',
    };
  }

  if (session.revokedAt) {
    return {
      ok: false,
      status: 401,
      code: 'NATIVE_SESSION_REVOKED',
      error: 'This native account session has been signed out.',
    };
  }

  if (isNativeSessionExpired(session, now)) {
    return {
      ok: false,
      status: 401,
      code: 'NATIVE_SESSION_EXPIRED',
      error: 'This native account session has expired. Please sign in again.',
    };
  }

  const userId = session.userId ?? session.user?.id;
  if (!userId) {
    return {
      ok: false,
      status: 401,
      code: 'NATIVE_SESSION_REQUIRED',
      error: 'A signed-in native account session is required for this request.',
    };
  }

  return {
    ok: true,
    token,
    session: {
      id: session.id,
      userId,
      expiresAt: session.expiresAt,
      revokedAt: null,
    },
    user: session.user ?? null,
  };
}

function readBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function readTokenFromUnknownJson(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const token = (value as { sessionToken?: unknown }).sessionToken;
  return typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
}

export async function readNativeSessionTokenFromRequest(request: Request) {
  const bearerToken = readBearerToken(request.headers.get('authorization'));
  if (bearerToken) {
    return bearerToken;
  }

  const headerToken = request.headers.get('x-calorie-compass-native-session')?.trim();
  if (headerToken) {
    return headerToken;
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return readTokenFromUnknownJson(await request.clone().json());
  } catch {
    return null;
  }
}
