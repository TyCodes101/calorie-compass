import { createHash, randomBytes } from 'crypto';

import type { PrismaClient } from '@prisma/client';

import type { VerifiedAppleIdentity } from '@/lib/auth/apple-token-verification';
import { prisma } from '@/lib/prisma';

const nativeAuthProvider = 'apple';
const nativeSessionTokenBytes = 32;
export const nativeSessionTtlMs = 1000 * 60 * 60 * 24 * 30;

type NativeSessionPrisma = Pick<PrismaClient, '$transaction' | 'nativeSession'>;

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

export type RevokeNativeSessionResult =
  | { revoked: true; reason: 'revoked' | 'expired' }
  | { revoked: false; reason: 'missing_token' | 'persistence_unavailable' | 'not_found' | 'already_revoked' };

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
  client = prisma,
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

export async function getUserForNativeSessionToken(
  token: string | null | undefined,
  { now = new Date(), client = prisma }: { now?: Date; client?: Pick<PrismaClient, 'nativeSession'> } = {},
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
  { now = new Date(), client = prisma }: { now?: Date; client?: Pick<PrismaClient, 'nativeSession'> } = {},
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
