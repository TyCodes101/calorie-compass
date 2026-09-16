import { cookies, headers } from 'next/headers';
import type { UserProfile } from '@prisma/client';

import { buildGuestUserEmail, getGuestPlaceholderName, guestSessionCookieName } from '@/lib/auth-session';
import { getUserForNativeSessionToken } from '@/lib/auth/native-session';
import { prisma } from '@/lib/prisma';
import { defaultProfileSettings } from '@/lib/profile-settings';

export function hasDatabaseConnectionString() {
  return Boolean(process.env.DATABASE_URL);
}

function buildLocalMockUserWithProfile() {
  const now = new Date();
  return {
    id: 'local-demo-user',
    name: 'Tyler',
    email: 'local-demo@guest.caloriecompass.local',
    demo: true,
    createdAt: now,
    updatedAt: now,
    profile: {
      id: 'local-demo-profile',
      userId: 'local-demo-user',
      age: null,
      heightCm: null,
      weightLbs: null,
      goal: 'MAINTAIN' as const,
      activityLevel: 'MODERATE' as const,
      dailyCalorieGoal: 2200,
      proteinGoal: 160,
      aiPreferenceNotes: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

async function readGuestSessionId() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(guestSessionCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

async function readNativeSessionToken() {
  try {
    const headerStore = await headers();
    const authorization = headerStore.get('authorization');
    const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
    return bearerMatch?.[1]?.trim() || headerStore.get('x-calorie-compass-native-session')?.trim() || null;
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
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: getGuestPlaceholderName(),
      email,
      demo: true,
    },
  });

  return ensureProfileForUser(user);
}

async function ensureProfileForUser<T extends { id: string; profile?: UserProfile | null }>(user: T | null) {
  if (!user) return null;
  if (user.profile) return { ...user, profile: user.profile };

  const profile = await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      age: defaultProfileSettings.age ?? null,
      heightCm: defaultProfileSettings.heightCm ?? null,
      weightLbs: defaultProfileSettings.weightLbs ?? null,
      goal: defaultProfileSettings.goal,
      activityLevel: defaultProfileSettings.activityLevel,
      dailyCalorieGoal: defaultProfileSettings.dailyCalorieGoal,
      proteinGoal: defaultProfileSettings.proteinGoal,
      aiPreferenceNotes: defaultProfileSettings.nutritionPreferences ?? null,
    },
    update: {},
  });
  return { ...user, profile };
}

async function getOrCreateGuestUserId() {
  const sessionId = await readGuestSessionId();
  if (!sessionId) {
    return null;
  }

  const email = buildGuestUserEmail(sessionId);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: getGuestPlaceholderName(),
      email,
      demo: true,
    },
    select: { id: true },
  });
}

export async function getCurrentUserWithProfile() {
  if (!hasDatabaseConnectionString()) {
    return buildLocalMockUserWithProfile();
  }

  const nativeSessionUser = await getUserForNativeSessionToken(await readNativeSessionToken());
  if (nativeSessionUser) {
    return ensureProfileForUser(nativeSessionUser);
  }

  const guestUser = await getOrCreateGuestUserWithProfile();
  if (guestUser) {
    return guestUser;
  }

  return null;
}

export async function getCurrentUserId() {
  if (!hasDatabaseConnectionString()) {
    return 'local-demo-user';
  }

  const nativeSessionUser = await getUserForNativeSessionToken(await readNativeSessionToken());
  if (nativeSessionUser) {
    return nativeSessionUser.id;
  }

  const guestUser = await getOrCreateGuestUserId();
  if (guestUser) {
    return guestUser.id;
  }

  return null;
}
