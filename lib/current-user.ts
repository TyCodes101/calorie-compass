import { cookies } from 'next/headers';

import { buildGuestUserEmail, getGuestPlaceholderName, guestSessionCookieName } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

async function readGuestSessionId() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(guestSessionCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateGuestUserWithProfile() {
  const sessionId = await readGuestSessionId();
  if (!sessionId) {
    return null;
  }

  const email = buildGuestUserEmail(sessionId);

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      name: getGuestPlaceholderName(),
      email,
      demo: true,
    },
    include: { profile: true },
  });
}

async function getOrCreateGuestUserId() {
  const sessionId = await readGuestSessionId();
  if (!sessionId) {
    return null;
  }

  const email = buildGuestUserEmail(sessionId);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      name: getGuestPlaceholderName(),
      email,
      demo: true,
    },
    select: { id: true },
  });
}

export async function getCurrentUserWithProfile() {
  const guestUser = await getOrCreateGuestUserWithProfile();
  if (guestUser) {
    return guestUser;
  }

  return prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { profile: true },
  });
}

export async function getCurrentUserId() {
  const guestUser = await getOrCreateGuestUserId();
  if (guestUser) {
    return guestUser.id;
  }

  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return user?.id ?? null;
}
