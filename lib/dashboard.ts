import { PrismaClient, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { buildWeeklyTrendFromMeals, sumMealTotals } from '@/lib/dashboard-aggregation';
import { calculateRemainingCalories, toProgressValue } from '@/lib/nutrition';
import { summarizeStoredItems } from '@/lib/trust';
import { getCurrentUserWithProfile } from '@/lib/current-user';

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
  const user = await getCurrentUserWithProfile();

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
  const remainingCalories = calculateRemainingCalories(dailyTotals.calories, profile.dailyCalorieGoal);
  const proteinRemaining = Math.max(0, Math.round(profile.proteinGoal - dailyTotals.protein));

  const dailySummary = todayMeals.length === 0
    ? {
        title: 'Nothing logged yet today',
        description: 'Start with one natural message and the assistant will build the rest around it.',
      }
    : remainingCalories >= 0
      ? {
          title: remainingCalories === 0 ? 'Right on target so far' : `${remainingCalories} calories remaining`,
          description:
            proteinRemaining > 0
              ? `${proteinRemaining}g of protein left to hit your target without forcing the rest of the day.`
              : 'Protein is already in a strong place today. Keep the rest steady and realistic.',
        }
      : {
          title: `${Math.abs(remainingCalories)} calories over target`,
          description:
            proteinRemaining > 0
              ? `You are over on calories, but still have about ${proteinRemaining}g of protein left if dinner needs to be lighter.`
              : 'You are a bit over target, but the day is still useful data. Small adjustments beat starting over tomorrow.',
        };

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
    mealCount: todayMeals.length,
    remainingCalories,
    dailySummary,
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
