import { prisma } from '@/lib/prisma';
import { addDaysUtc, getPastSevenDays, isoDay, startOfDayUtc } from '@/lib/date';
import { calculateRemainingCalories, toProgressValue, zeroTotals } from '@/lib/nutrition';

export async function upsertDailyLogForDate(userId: string, inputDate: Date | string) {
  const date = startOfDayUtc(inputDate);
  const nextDay = addDaysUtc(date, 1);

  const meals = await prisma.meal.findMany({
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

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
      fiber: acc.fiber + meal.totalFiber,
      sugar: acc.sugar + meal.totalSugar,
      sodium: acc.sodium + meal.totalSodium,
    }),
    zeroTotals()
  );

  return prisma.dailyLog.upsert({
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
  const dailyLog = await upsertDailyLogForDate(user.id, date);

  const recentMeals = await prisma.meal.findMany({
    where: {
      userId: user.id,
      date: {
        gte: date,
        lt: nextDay,
      },
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const weeklyLogs = await prisma.dailyLog.findMany({
    where: {
      userId: user.id,
      date: {
        gte: getPastSevenDays(date)[0],
        lt: nextDay,
      },
    },
    orderBy: { date: 'asc' },
  });

  const trendMap = new Map(weeklyLogs.map((entry) => [isoDay(entry.date), entry]));
  const weeklyTrend = getPastSevenDays(date).map((day) => {
    const entry = trendMap.get(isoDay(day));
    return {
      date: isoDay(day),
      calories: Math.round(entry?.calories ?? 0),
      goal: profile.dailyCalorieGoal,
    };
  });

  const carbGoal = Math.round((profile.dailyCalorieGoal * 0.4) / 4);
  const fatGoal = Math.round((profile.dailyCalorieGoal * 0.3) / 9);

  return {
    user: {
      id: user.id,
      name: user.name,
    },
    profile,
    date: isoDay(date),
    totals: {
      calories: Math.round(dailyLog.calories),
      protein: Math.round(dailyLog.protein),
      carbs: Math.round(dailyLog.carbs),
      fat: Math.round(dailyLog.fat),
      fiber: Math.round(dailyLog.fiber),
      sugar: Math.round(dailyLog.sugar),
      sodium: Math.round(dailyLog.sodium),
    },
    remainingCalories: calculateRemainingCalories(dailyLog.calories, profile.dailyCalorieGoal),
    macroGoals: {
      calories: profile.dailyCalorieGoal,
      protein: profile.proteinGoal,
      carbs: carbGoal,
      fat: fatGoal,
    },
    macroProgress: {
      protein: toProgressValue(dailyLog.protein, profile.proteinGoal),
      carbs: toProgressValue(dailyLog.carbs, carbGoal),
      fat: toProgressValue(dailyLog.fat, fatGoal),
    },
    recentMeals: recentMeals.map((meal) => ({
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
    })),
    weeklyTrend,
    disclaimer: 'Nutrition estimates are approximate and are not medical or dietary advice.',
  };
}
