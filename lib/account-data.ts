import { getCurrentUserWithProfile } from '@/lib/current-user';
import { logConnectionReady, logWriteFailure, logWriteStart, logWriteSuccess } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';

function requireUser<T>(value: T | null): T {
  if (!value) {
    throw new Error('No user found. Complete onboarding first.');
  }

  return value;
}

export async function exportAccountData() {
  const user = requireUser(await getCurrentUserWithProfile());

  logWriteStart('account.export', { userId: user.id });

  try {
    await prisma.$connect();
    logConnectionReady('account.export', { userId: user.id });

    const [meals, favorites, weightEntries] = await Promise.all([
      prisma.meal.findMany({
        where: { userId: user.id },
        include: { items: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.reusableMeal.findMany({
        where: { userId: user.id },
        include: { items: true },
        orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.weightEntry.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        demo: user.demo,
      },
      profile: user.profile
        ? {
            age: user.profile.age,
            heightCm: user.profile.heightCm,
            weightLbs: user.profile.weightLbs,
            goal: user.profile.goal,
            activityLevel: user.profile.activityLevel,
            dailyCalorieGoal: user.profile.dailyCalorieGoal,
            proteinGoal: user.profile.proteinGoal,
            nutritionPreferences: user.profile.aiPreferenceNotes,
            createdAt: user.profile.createdAt.toISOString(),
            updatedAt: user.profile.updatedAt.toISOString(),
          }
        : null,
      meals: meals.map((meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        date: meal.date.toISOString(),
        createdAt: meal.createdAt.toISOString(),
        updatedAt: meal.updatedAt.toISOString(),
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
        items: meal.items.map((item) => ({
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
          nutritionSourceType: item.nutritionSourceType,
          nutritionSourceName: item.nutritionSourceName,
          catalogFoodId: item.catalogFoodId,
        })),
      })),
      favoriteMeals: favorites.map((favorite) => ({
        id: favorite.id,
        title: favorite.title,
        rawText: favorite.rawText,
        mealType: favorite.mealType,
        confidenceScore: favorite.confidenceScore,
        isFavorite: favorite.isFavorite,
        lastUsedAt: favorite.lastUsedAt?.toISOString() ?? null,
        createdAt: favorite.createdAt.toISOString(),
        updatedAt: favorite.updatedAt.toISOString(),
        items: favorite.items.map((item) => ({
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
          isTrusted: item.isTrusted,
          sourceType: item.sourceType,
          sourceName: item.sourceName,
          catalogFoodId: item.catalogFoodId,
        })),
      })),
      weightEntries: weightEntries.map((entry) => ({
        id: entry.id,
        date: entry.date.toISOString(),
        weightLbs: entry.weightLbs,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    logWriteSuccess('account.export', {
      userId: user.id,
      mealCount: meals.length,
      favoriteCount: favorites.length,
      weightEntryCount: weightEntries.length,
    });

    return payload;
  } catch (error) {
    logWriteFailure('account.export', error, { userId: user.id });
    throw error;
  }
}

export async function resetDemoData() {
  const user = requireUser(await getCurrentUserWithProfile());

  logWriteStart('account.reset', { userId: user.id });

  try {
    await prisma.$connect();
    logConnectionReady('account.reset', { userId: user.id });

    const result = await prisma.$transaction(async (tx) => {
      const reusableMeals = await tx.reusableMeal.deleteMany({ where: { userId: user.id } });
      const meals = await tx.meal.deleteMany({ where: { userId: user.id } });
      const dailyLogs = await tx.dailyLog.deleteMany({ where: { userId: user.id } });
      const weightEntries = await tx.weightEntry.deleteMany({ where: { userId: user.id } });

      return {
        reusableMeals: reusableMeals.count,
        meals: meals.count,
        dailyLogs: dailyLogs.count,
        weightEntries: weightEntries.count,
      };
    });

    logWriteSuccess('account.reset', {
      userId: user.id,
      ...result,
    });

    return result;
  } catch (error) {
    logWriteFailure('account.reset', error, { userId: user.id });
    throw error;
  }
}
