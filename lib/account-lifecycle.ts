import { buildGuestUserEmail, guestSessionCookieName, isGuestUser } from '@/lib/auth-session';
import { prisma } from '@/lib/prisma';

type CountResult = { count: number };
type GuestUserRecord = { id: string; email: string | null; demo: boolean | null };
type ProfileRecord = { id: string; userId: string };
type ReusableMealRecord = { id: string; sourceMealId: string | null };
type DailyLogRecord = { id: string; date: Date };
type ExportRecord = Record<string, unknown>;

type LifecycleTransaction = {
  user: {
    findUnique: (args: unknown) => Promise<GuestUserRecord | null>;
    delete: (args: unknown) => Promise<unknown>;
  };
  userProfile: {
    findUnique: (args: unknown) => Promise<ProfileRecord | null>;
    update: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  meal: {
    updateMany: (args: unknown) => Promise<CountResult>;
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  reusableMeal: {
    findMany: (args: unknown) => Promise<ReusableMealRecord[]>;
    updateMany: (args: unknown) => Promise<CountResult>;
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  dailyLog: {
    findMany: (args: unknown) => Promise<DailyLogRecord[]>;
    updateMany: (args: unknown) => Promise<CountResult>;
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  weightEntry: {
    updateMany: (args: unknown) => Promise<CountResult>;
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  userAuthProvider: {
    deleteMany: (args: unknown) => Promise<CountResult>;
  };
  nativeSession: {
    updateMany: (args: unknown) => Promise<CountResult>;
  };
};

type LifecyclePrisma = {
  $transaction: <T>(callback: (tx: LifecycleTransaction) => Promise<T>) => Promise<T>;
  user: {
    findUnique: (args: unknown) => Promise<(ExportRecord & { profile?: ExportRecord | null }) | null>;
  };
  meal: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
  reusableMeal: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
  dailyLog: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
  weightEntry: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
  userAuthProvider: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
  nativeSession: {
    findMany: (args: unknown) => Promise<ExportRecord[]>;
  };
};

const lifecyclePrisma = prisma as unknown as LifecyclePrisma;

export type LifecycleCounts = {
  profile: number;
  meals: number;
  reusableMeals: number;
  dailyLogs: number;
  weightEntries: number;
};

export type GuestMigrationResult = {
  status: 'migrated' | 'no_guest_session' | 'no_guest_user' | 'already_migrated' | 'unsafe_guest_user';
  accountUserId: string;
  guestUserId: string | null;
  migrated: LifecycleCounts;
  skipped: LifecycleCounts;
};

function emptyCounts(): LifecycleCounts {
  return {
    profile: 0,
    meals: 0,
    reusableMeals: 0,
    dailyLogs: 0,
    weightEntries: 0,
  };
}

function hasAnyCount(counts: LifecycleCounts) {
  return Object.values(counts).some((count) => count > 0);
}

function dateKey(date: Date) {
  return date.toISOString();
}

function cookieValueFromHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) {
    return null;
  }

  const rawValue = match.slice(prefix.length);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function readGuestSessionIdFromRequest(request: Request) {
  const value = cookieValueFromHeader(request.headers.get('cookie'), guestSessionCookieName)?.trim();
  return value || null;
}

async function moveProfile({
  tx,
  guestUserId,
  accountUserId,
}: {
  tx: LifecycleTransaction;
  guestUserId: string;
  accountUserId: string;
}) {
  const accountProfile = await tx.userProfile.findUnique({
    where: { userId: accountUserId },
    select: { id: true, userId: true },
  });
  const guestProfile = await tx.userProfile.findUnique({
    where: { userId: guestUserId },
    select: { id: true, userId: true },
  });

  if (!guestProfile) {
    return { migrated: 0, skipped: 0 };
  }

  if (accountProfile) {
    return { migrated: 0, skipped: 1 };
  }

  await tx.userProfile.update({
    where: { id: guestProfile.id },
    data: { userId: accountUserId },
  });

  return { migrated: 1, skipped: 0 };
}

async function moveReusableMeals({
  tx,
  guestUserId,
  accountUserId,
}: {
  tx: LifecycleTransaction;
  guestUserId: string;
  accountUserId: string;
}) {
  const guestReusableMeals = await tx.reusableMeal.findMany({
    where: { userId: guestUserId },
    select: { id: true, sourceMealId: true },
  });
  if (guestReusableMeals.length === 0) {
    return { migrated: 0, skipped: 0 };
  }

  const accountReusableMeals = await tx.reusableMeal.findMany({
    where: { userId: accountUserId, sourceMealId: { not: null } },
    select: { id: true, sourceMealId: true },
  });
  const accountSourceMealIds = new Set(accountReusableMeals.map((meal) => meal.sourceMealId).filter(Boolean));
  const moveIds = guestReusableMeals
    .filter((meal) => !meal.sourceMealId || !accountSourceMealIds.has(meal.sourceMealId))
    .map((meal) => meal.id);

  if (moveIds.length === 0) {
    return { migrated: 0, skipped: guestReusableMeals.length };
  }

  const result = await tx.reusableMeal.updateMany({
    where: { id: { in: moveIds } },
    data: { userId: accountUserId },
  });

  return {
    migrated: result.count,
    skipped: guestReusableMeals.length - result.count,
  };
}

async function moveDailyLogs({
  tx,
  guestUserId,
  accountUserId,
}: {
  tx: LifecycleTransaction;
  guestUserId: string;
  accountUserId: string;
}) {
  const guestDailyLogs = await tx.dailyLog.findMany({
    where: { userId: guestUserId },
    select: { id: true, date: true },
  });
  if (guestDailyLogs.length === 0) {
    return { migrated: 0, skipped: 0 };
  }

  const accountDailyLogs = await tx.dailyLog.findMany({
    where: {
      userId: accountUserId,
      date: { in: guestDailyLogs.map((log) => log.date) },
    },
    select: { id: true, date: true },
  });
  const accountDates = new Set(accountDailyLogs.map((log) => dateKey(log.date)));
  const moveIds = guestDailyLogs.filter((log) => !accountDates.has(dateKey(log.date))).map((log) => log.id);

  if (moveIds.length === 0) {
    return { migrated: 0, skipped: guestDailyLogs.length };
  }

  const result = await tx.dailyLog.updateMany({
    where: { id: { in: moveIds } },
    data: { userId: accountUserId },
  });

  return {
    migrated: result.count,
    skipped: guestDailyLogs.length - result.count,
  };
}

export async function migrateGuestDataToAccount({
  guestSessionId,
  accountUserId,
  client = lifecyclePrisma,
}: {
  guestSessionId: string | null | undefined;
  accountUserId: string;
  client?: Pick<LifecyclePrisma, '$transaction'>;
}): Promise<GuestMigrationResult> {
  const base = {
    accountUserId,
    guestUserId: null,
    migrated: emptyCounts(),
    skipped: emptyCounts(),
  };

  if (!guestSessionId) {
    return {
      ...base,
      status: 'no_guest_session',
    };
  }

  return client.$transaction(async (tx) => {
    const guestUser = await tx.user.findUnique({
      where: { email: buildGuestUserEmail(guestSessionId) },
      select: { id: true, email: true, demo: true },
    });

    if (!guestUser) {
      return {
        ...base,
        status: 'no_guest_user',
      };
    }

    if (guestUser.id === accountUserId) {
      return {
        ...base,
        status: 'already_migrated',
        guestUserId: guestUser.id,
      };
    }

    if (!isGuestUser(guestUser)) {
      return {
        ...base,
        status: 'unsafe_guest_user',
        guestUserId: guestUser.id,
      };
    }

    const migrated = emptyCounts();
    const skipped = emptyCounts();

    const profileResult = await moveProfile({ tx, guestUserId: guestUser.id, accountUserId });
    migrated.profile = profileResult.migrated;
    skipped.profile = profileResult.skipped;

    const mealResult = await tx.meal.updateMany({
      where: { userId: guestUser.id },
      data: { userId: accountUserId },
    });
    migrated.meals = mealResult.count;

    const reusableMealResult = await moveReusableMeals({ tx, guestUserId: guestUser.id, accountUserId });
    migrated.reusableMeals = reusableMealResult.migrated;
    skipped.reusableMeals = reusableMealResult.skipped;

    const dailyLogResult = await moveDailyLogs({ tx, guestUserId: guestUser.id, accountUserId });
    migrated.dailyLogs = dailyLogResult.migrated;
    skipped.dailyLogs = dailyLogResult.skipped;

    const weightEntryResult = await tx.weightEntry.updateMany({
      where: { userId: guestUser.id },
      data: { userId: accountUserId },
    });
    migrated.weightEntries = weightEntryResult.count;

    return {
      status: hasAnyCount(migrated) ? 'migrated' : 'already_migrated',
      accountUserId,
      guestUserId: guestUser.id,
      migrated,
      skipped,
    };
  });
}

function toIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === 'string' ? value : null;
}

function serializeItem(item: ExportRecord) {
  return {
    id: item.id,
    foodName: item.foodName,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
    sugar: item.sugar,
    sodium: item.sodium,
    notes: item.notes,
    nutritionSourceType: item.nutritionSourceType ?? item.sourceType,
    nutritionSourceName: item.nutritionSourceName ?? item.sourceName,
    catalogFoodId: item.catalogFoodId,
  };
}

function serializeMeal(meal: ExportRecord) {
  return {
    id: meal.id,
    mealType: meal.mealType,
    date: toIso(meal.date),
    createdAt: toIso(meal.createdAt),
    updatedAt: toIso(meal.updatedAt),
    rawText: meal.rawText,
    notes: meal.notes,
    confidenceScore: meal.confidenceScore,
    totals: {
      calories: meal.totalCalories,
      protein: meal.totalProtein,
      carbs: meal.totalCarbs,
      fat: meal.totalFat,
      fiber: meal.totalFiber,
      sugar: meal.totalSugar,
      sodium: meal.totalSodium,
    },
    items: Array.isArray(meal.items) ? meal.items.map((item) => serializeItem(item as ExportRecord)) : [],
  };
}

function serializeProfile(profile: ExportRecord | null | undefined) {
  if (!profile) {
    return null;
  }

  return {
    age: profile.age,
    heightCm: profile.heightCm,
    weightLbs: profile.weightLbs,
    goal: profile.goal,
    activityLevel: profile.activityLevel,
    dailyCalorieGoal: profile.dailyCalorieGoal,
    proteinGoal: profile.proteinGoal,
    nutritionPreferences: profile.aiPreferenceNotes,
    createdAt: toIso(profile.createdAt),
    updatedAt: toIso(profile.updatedAt),
  };
}

export async function exportNativeAccountData({
  accountUserId,
  client = lifecyclePrisma,
}: {
  accountUserId: string;
  client?: Omit<LifecyclePrisma, '$transaction'>;
}) {
  const user = await client.user.findUnique({
    where: { id: accountUserId },
    include: { profile: true },
  });

  if (!user) {
    return null;
  }

  const [meals, reusableMeals, dailyLogs, weightEntries, authProviders, nativeSessions] = await Promise.all([
    client.meal.findMany({
      where: { userId: accountUserId },
      include: { items: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    client.reusableMeal.findMany({
      where: { userId: accountUserId },
      include: { items: true },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    client.dailyLog.findMany({
      where: { userId: accountUserId },
      orderBy: { date: 'desc' },
    }),
    client.weightEntry.findMany({
      where: { userId: accountUserId },
      orderBy: { date: 'desc' },
    }),
    client.userAuthProvider.findMany({
      where: { userId: accountUserId },
      select: {
        id: true,
        provider: true,
        providerSubject: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    client.nativeSession.findMany({
      where: { userId: accountUserId },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      userId: user.id,
      name: user.name,
      email: user.email,
      demo: user.demo,
      createdAt: toIso(user.createdAt),
      updatedAt: toIso(user.updatedAt),
    },
    profile: serializeProfile(user.profile),
    meals: meals.map(serializeMeal),
    reusableMeals: reusableMeals.map((meal) => ({
      ...serializeMeal(meal),
      title: meal.title,
      isFavorite: meal.isFavorite,
      lastUsedAt: toIso(meal.lastUsedAt),
    })),
    dailyLogs: dailyLogs.map((log) => ({
      id: log.id,
      date: toIso(log.date),
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
      fiber: log.fiber,
      sugar: log.sugar,
      sodium: log.sodium,
      createdAt: toIso(log.createdAt),
      updatedAt: toIso(log.updatedAt),
    })),
    weightEntries: weightEntries.map((entry) => ({
      id: entry.id,
      date: toIso(entry.date),
      weightLbs: entry.weightLbs,
      createdAt: toIso(entry.createdAt),
      updatedAt: toIso(entry.updatedAt),
    })),
    authProviders: authProviders.map((provider) => ({
      id: provider.id,
      provider: provider.provider,
      providerSubject: provider.providerSubject,
      email: provider.email,
      emailVerified: provider.emailVerified,
      createdAt: toIso(provider.createdAt),
      updatedAt: toIso(provider.updatedAt),
    })),
    nativeSessions: nativeSessions.map((session) => ({
      id: session.id,
      expiresAt: toIso(session.expiresAt),
      revokedAt: toIso(session.revokedAt),
      createdAt: toIso(session.createdAt),
      updatedAt: toIso(session.updatedAt),
    })),
  };
}

export async function deleteNativeAccount({
  accountUserId,
  now = new Date(),
  client = lifecyclePrisma,
}: {
  accountUserId: string;
  now?: Date;
  client?: Pick<LifecyclePrisma, '$transaction'>;
}) {
  return client.$transaction(async (tx) => {
    const reusableMeals = await tx.reusableMeal.deleteMany({ where: { userId: accountUserId } });
    const meals = await tx.meal.deleteMany({ where: { userId: accountUserId } });
    const dailyLogs = await tx.dailyLog.deleteMany({ where: { userId: accountUserId } });
    const weightEntries = await tx.weightEntry.deleteMany({ where: { userId: accountUserId } });
    const profile = await tx.userProfile.deleteMany({ where: { userId: accountUserId } });
    const authProviders = await tx.userAuthProvider.deleteMany({ where: { userId: accountUserId } });
    const nativeSessions = await tx.nativeSession.updateMany({
      where: { userId: accountUserId, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.user.delete({
      where: { id: accountUserId },
    });

    return {
      deleted: {
        profile: profile.count,
        meals: meals.count,
        reusableMeals: reusableMeals.count,
        dailyLogs: dailyLogs.count,
        weightEntries: weightEntries.count,
        authProviders: authProviders.count,
      },
      revokedSessions: nativeSessions.count,
    };
  });
}
