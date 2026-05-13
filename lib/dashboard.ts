import { PrismaClient, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { buildWeeklyTrendFromMeals, sumMealTotals } from '@/lib/dashboard-aggregation';
import { calculateRemainingCalories, toProgressValue } from '@/lib/nutrition';
import { summarizeStoredItems } from '@/lib/trust';

type DashboardWriteClient = PrismaClient | Prisma.TransactionClient;

export async function upsertDailyLogForDate(userId: string, inputDate: Date | string, db: DashboardWriteClient = prisma) {
  const date = startOfDayUtc(inputDate);
  const nextDay = addDaysUtc(date, 1);

  const meals = await db.meal.findMany({
    where: {
      userId,
      date: {
        gte: date,
        lt: nextDay,
      },
    },
    select: {
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFat: true,
      totalFiber: true,
      totalSugar: true,
      totalSodium: true,
    },
  });

  const totals = sumMealTotals(meals);

  return db.dailyLog.upsert({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    update: totals,
    create: {
      userId,
      date,
      ...totals,
    },
  });
}

export async function getDashboardData(inputDate: Date | string = new Date()) {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { profile: true },
  });

  if (!user || !user.profile) {
    return null;
  }

  const profile = user.profile;
  const date = startOfDayUtc(inputDate);
  const nextDay = addDaysUtc(date, 1);

  const todayMeals = await prisma.meal.findMany({
    where: {
      userId: user.id,
      date: {
        gte: date,
        lt: nextDay,
      },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const dailyTotals = sumMealTotals(todayMeals);

  const weeklyMeals = await prisma.meal.findMany({
    where: {
      userId: user.id,
      date: {
        gte: addDaysUtc(date, -6),
        lt: nextDay,
      },
    },
    select: {
      date: true,
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFat: true,
      totalFiber: true,
      totalSugar: true,
      totalSodium: true,
    },
  });

  const weeklyTrend = buildWeeklyTrendFromMeals(weeklyMeals, date, profile.dailyCalorieGoal);
  const carbGoal = Math.round((profile.dailyCalorieGoal * 0.4) / 4);
  const fatGoal = Math.round((profile.dailyCalorieGoal * 0.3) / 9);
  const todayItems = todayMeals.flatMap((meal) => meal.items);
  const trustSummary = summarizeStoredItems(todayItems);

  return {
    user: {
      id: user.id,
      name: user.name,
    },
    profile,
    date: date.toISOString().slice(0, 10),
    totals: {
      calories: Math.round(dailyTotals.calories),
      protein: Math.round(dailyTotals.protein),
      carbs: Math.round(dailyTotals.carbs),
      fat: Math.round(dailyTotals.fat),
      fiber: Math.round(dailyTotals.fiber),
      sugar: Math.round(dailyTotals.sugar),
      sodium: Math.round(dailyTotals.sodium),
    },
    remainingCalories: calculateRemainingCalories(dailyTotals.calories, profile.dailyCalorieGoal),
    macroGoals: {
      calories: profile.dailyCalorieGoal,
      protein: profile.proteinGoal,
      carbs: carbGoal,
      fat: fatGoal,
    },
    macroProgress: {
      protein: toProgressValue(dailyTotals.protein, profile.proteinGoal),
      carbs: toProgressValue(dailyTotals.carbs, carbGoal),
      fat: toProgressValue(dailyTotals.fat, fatGoal),
    },
    trustSummary: {
      ...trustSummary,
      headline: trustSummary.totalCount ? `${trustSummary.coveragePercent}% of today’s foods verified` : 'No meals logged yet',
      detail: trustSummary.totalCount
        ? `${trustSummary.trustedCount} foods matched trusted nutrition sources`
        : 'Log a meal to see verified coverage and source transparency.',
    },
    recentMeals: todayMeals.slice(0, 5).map((meal) => {
      const summary = summarizeStoredItems(meal.items);

      return {
        id: meal.id,
        mealType: meal.mealType.toLowerCase(),
        rawText: meal.rawText,
        totalCalories: Math.round(meal.totalCalories),
        totalProtein: Math.round(meal.totalProtein),
        totalCarbs: Math.round(meal.totalCarbs),
        totalFat: Math.round(meal.totalFat),
        confidenceScore: meal.confidenceScore,
        itemCount: meal.items.length,
        createdAt: meal.createdAt.toISOString(),
        trustedCount: summary.trustedCount,
        estimatedCount: summary.estimatedCount,
        coverageSummary: summary.coverageSummary,
      };
    }),
    weeklyTrend,
    disclaimer: 'Nutrition estimates are approximate and are not medical or dietary advice.',
  };
}
