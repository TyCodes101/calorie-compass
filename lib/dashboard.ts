import { PrismaClient, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { buildWeeklyTrendFromMeals, sumMealTotals } from '@/lib/dashboard-aggregation';
import { calculateRemainingCalories, toProgressValue } from '@/lib/nutrition';
import { summarizeStoredItems } from '@/lib/trust';
import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { formatMealTitleForDisplay, isFixtureMealRecord } from '@/lib/meal-display';
import { buildDashboardStreaks } from '@/lib/growth-metrics';
import { buildWeeklyInsights } from '@/lib/weekly-insights';

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

  if (!hasDatabaseConnectionString()) {
    const carbGoal = Math.round((profile.dailyCalorieGoal * 0.4) / 4);
    const fatGoal = Math.round((profile.dailyCalorieGoal * 0.3) / 9);

    return {
      user: {
        id: user.id,
        name: user.name,
      },
      profile,
      date: date.toISOString().slice(0, 10),
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      },
      mealCount: 0,
      remainingCalories: profile.dailyCalorieGoal,
      dailySummary: {
        title: 'Nothing logged yet today',
        description: 'Start with one natural message and the assistant will build the rest around it.',
      },
      macroGoals: {
        calories: profile.dailyCalorieGoal,
        protein: profile.proteinGoal,
        carbs: carbGoal,
        fat: fatGoal,
      },
      macroProgress: {
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      trustSummary: {
        totalCount: 0,
        trustedCount: 0,
        estimatedCount: 0,
        coveragePercent: 0,
        coverageSummary: 'No foods logged yet',
        estimatedSummary: 'No estimates yet',
        headline: 'No meals logged yet',
        detail: 'Log a meal to see verified coverage and source transparency.',
      },
      recentMeals: [],
      weeklyTrend: buildWeeklyTrendFromMeals([], date, profile.dailyCalorieGoal),
      streaks: buildDashboardStreaks({ currentDate: date, meals: [], proteinGoal: profile.proteinGoal }),
      weeklyInsights: buildWeeklyInsights({ currentDate: date, meals: [] }),
      disclaimer: 'Nutrition estimates are approximate and are not medical or dietary advice.',
    };
  }

  const todayMeals = (await prisma.meal.findMany({
    where: {
      userId: user.id,
      date: {
        gte: date,
        lt: nextDay,
      },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })).filter((meal) => !isFixtureMealRecord({ rawText: meal.rawText, items: meal.items }));

  const dailyTotals = sumMealTotals(todayMeals);

  const weeklyMeals = (await prisma.meal.findMany({
    where: {
      userId: user.id,
      date: {
        gte: addDaysUtc(date, -6),
        lt: nextDay,
      },
    },
    select: {
      date: true,
      rawText: true,
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFat: true,
      totalFiber: true,
      totalSugar: true,
      totalSodium: true,
      items: {
        select: {
          foodName: true,
        },
      },
    },
  })).filter((meal) => !isFixtureMealRecord({ rawText: meal.rawText, items: meal.items }));

  const weeklyTrend = buildWeeklyTrendFromMeals(weeklyMeals, date, profile.dailyCalorieGoal);
  const weeklyInsights = buildWeeklyInsights({
    currentDate: date,
    meals: weeklyMeals.map((meal) => ({
      date: meal.date,
      totalCalories: meal.totalCalories,
      totalProtein: meal.totalProtein,
    })),
  });
  const carbGoal = Math.round((profile.dailyCalorieGoal * 0.4) / 4);
  const fatGoal = Math.round((profile.dailyCalorieGoal * 0.3) / 9);
  const todayItems = todayMeals.flatMap((meal) => meal.items);
  const trustSummary = summarizeStoredItems(todayItems);
  const roundedProteinTotal = Math.round(dailyTotals.protein);
  const remainingCalories = calculateRemainingCalories(dailyTotals.calories, profile.dailyCalorieGoal);
  const proteinRemaining = Math.max(0, profile.proteinGoal - roundedProteinTotal);

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
      headline: trustSummary.totalCount ? `${trustSummary.coveragePercent}% source coverage` : 'No meals logged yet',
      detail: trustSummary.totalCount
        ? `${trustSummary.trustedCount} foods matched structured nutrition data`
        : 'Log a meal to see verified coverage and source transparency.',
    },
    recentMeals: todayMeals.slice(0, 5).map((meal) => {
      const summary = summarizeStoredItems(meal.items);

      return {
        id: meal.id,
        mealType: meal.mealType.toLowerCase(),
        rawText: formatMealTitleForDisplay(meal.rawText, meal.items.map((item) => ({ food_name: item.foodName, quantity: item.quantity, unit: item.unit }))),
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
    streaks: buildDashboardStreaks({
      currentDate: date,
      proteinGoal: profile.proteinGoal,
      meals: weeklyMeals.map((meal) => ({
        date: meal.date,
        totalCalories: meal.totalCalories,
        totalProtein: meal.totalProtein,
        totalCarbs: meal.totalCarbs,
        totalFat: meal.totalFat,
      })),
    }),
    weeklyInsights,
    disclaimer: 'Nutrition estimates are approximate and are not medical or dietary advice.',
  };
}
