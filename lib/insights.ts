import { ActivityLevel, type NutritionSourceType } from '@prisma/client';

import { getPastSevenDays, isoDay, startOfDayUtc } from '@/lib/date';
import { sumMealTotals } from '@/lib/dashboard-aggregation';
import { calculateRemainingCalories, toProgressValue } from '@/lib/nutrition';
import { prisma } from '@/lib/prisma';
import { summarizeTrustCounts } from '@/lib/trust';
import { getCurrentUserWithProfile } from '@/lib/current-user';

type MealLike = {
  date: Date;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
  items?: Array<{
    nutritionSourceType: NutritionSourceType | null;
  }>;
};

type ProfileLike = {
  dailyCalorieGoal: number;
  proteinGoal: number;
  activityLevel: ActivityLevel;
};

type PatternCardTone = 'live' | 'guide';

type WeeklyDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedMeals: number;
  trustedCount: number;
  estimatedCount: number;
  mealTypeCounts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK', number>;
  logged: boolean;
};

function emptyMealTypeCounts() {
  return {
    BREAKFAST: 0,
    LUNCH: 0,
    DINNER: 0,
    SNACK: 0,
  };
}

function buildDaysWithTotals(meals: MealLike[], inputDate: Date | string): WeeklyDay[] {
  const totalsByDay = new Map<string, WeeklyDay>();

  for (const day of getPastSevenDays(inputDate)) {
    totalsByDay.set(isoDay(day), {
      date: isoDay(day),
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      loggedMeals: 0,
      trustedCount: 0,
      estimatedCount: 0,
      mealTypeCounts: emptyMealTypeCounts(),
      logged: false,
    });
  }

  for (const meal of meals) {
    const key = isoDay(meal.date);
    const current = totalsByDay.get(key);

    if (!current) {
      continue;
    }

    const trustedCount = meal.items?.filter((item) => item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE').length ?? 0;
    const estimatedCount = (meal.items?.length ?? 0) - trustedCount;

    current.calories += meal.totalCalories;
    current.protein += meal.totalProtein;
    current.carbs += meal.totalCarbs;
    current.fat += meal.totalFat;
    current.loggedMeals += 1;
    current.trustedCount += trustedCount;
    current.estimatedCount += estimatedCount;
    current.mealTypeCounts[meal.mealType] += 1;
    current.logged = true;
  }

  return getPastSevenDays(inputDate).map((day) => totalsByDay.get(isoDay(day))!).map((day) => ({
    ...day,
    calories: Math.round(day.calories),
    protein: Math.round(day.protein),
    carbs: Math.round(day.carbs),
    fat: Math.round(day.fat),
  }));
}

function computeMacroBalanceLabel(calories: number, protein: number, carbs: number, fat: number) {
  const macroCalories = protein * 4 + carbs * 4 + fat * 9;

  if (macroCalories <= 0 || calories <= 0) {
    return 'No macro pattern yet';
  }

  const proteinShare = (protein * 4) / macroCalories;
  const carbShare = (carbs * 4) / macroCalories;
  const fatShare = (fat * 9) / macroCalories;

  if (proteinShare >= 0.3 && carbShare <= 0.45) {
    return 'Protein-forward balance';
  }

  if (carbShare >= 0.5) {
    return 'Carb-heavy so far';
  }

  if (fatShare >= 0.38) {
    return 'Fat-heavy so far';
  }

  return 'Balanced enough for a normal day';
}

function computeLoggingStreak(days: WeeklyDay[]) {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (!days[index]?.logged) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function getTopMealType(days: WeeklyDay[]) {
  const totals = emptyMealTypeCounts();

  for (const day of days) {
    totals.BREAKFAST += day.mealTypeCounts.BREAKFAST;
    totals.LUNCH += day.mealTypeCounts.LUNCH;
    totals.DINNER += day.mealTypeCounts.DINNER;
    totals.SNACK += day.mealTypeCounts.SNACK;
  }

  const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top = ordered[0];

  if (!top || top[1] === 0) {
    return 'No repeat meal pattern yet';
  }

  return `${top[0].toLowerCase()} is your most-logged meal`;
}

function buildPatternCards(days: WeeklyDay[], profile: ProfileLike, todayRemainingCalories: number) {
  const loggedDays = days.filter((day) => day.logged);
  const proteinConsistencyDays = days.filter((day) => day.logged && day.protein >= profile.proteinGoal * 0.85).length;
  const trustTotals = loggedDays.reduce(
    (acc, day) => ({
      trusted: acc.trusted + day.trustedCount,
      estimated: acc.estimated + day.estimatedCount,
    }),
    { trusted: 0, estimated: 0 },
  );
  const trustSummary = summarizeTrustCounts(trustTotals.trusted, trustTotals.estimated);

  return [
    {
      title: 'Logging rhythm',
      detail: `${loggedDays.length} of the last 7 days have meals logged.`,
      supporting: loggedDays.length >= 5 ? 'That is strong daily-use momentum for a calm logging routine.' : 'A steadier rhythm usually matters more than a perfect day.',
      tone: 'live' as PatternCardTone,
    },
    {
      title: 'Protein pace',
      detail: `${proteinConsistencyDays} of 7 days landed near your protein target.`,
      supporting: proteinConsistencyDays > 0 ? 'That usually makes the next correction smaller and easier.' : 'A small protein-focused repeat meal can improve consistency quickly.',
      tone: 'live' as PatternCardTone,
    },
    {
      title: 'Trust coverage',
      detail: trustSummary.totalCount ? `${trustSummary.coveragePercent}% of this week’s foods matched structured sources.` : 'No source coverage yet.',
      supporting: trustSummary.totalCount ? trustSummary.estimatedSummary : 'Once meals are logged, this area will explain how much was verified versus estimated.',
      tone: 'live' as PatternCardTone,
    },
    {
      title: 'Next best step',
      detail: todayRemainingCalories > 0 ? `You still have about ${todayRemainingCalories} calories remaining today.` : 'Today is already at or above your current calorie target.',
      supporting: todayRemainingCalories > 0 ? 'A familiar repeat meal can close the day faster than starting from scratch.' : 'Logging the next meal cleanly still matters more than chasing a perfect number.',
      tone: 'guide' as PatternCardTone,
    },
  ];
}

export function buildInsightsViewModel({
  currentDate = new Date(),
  profile,
  todayMeals,
  weeklyMeals,
}: {
  currentDate?: Date | string;
  profile: ProfileLike;
  todayMeals: MealLike[];
  weeklyMeals: MealLike[];
  weightEntries?: Array<{ date: Date; weightLbs: number }>;
}) {
  const today = startOfDayUtc(currentDate);
  const todayTotals = sumMealTotals(todayMeals);
  const weeklyDays = buildDaysWithTotals(weeklyMeals, today);
  const loggedDays = weeklyDays.filter((day) => day.logged);
  const loggingStreak = computeLoggingStreak(weeklyDays);
  const averageCalories = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length) : 0;
  const averageProtein = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length) : 0;
  const averageMealsPerDay = loggedDays.length ? Math.round((loggedDays.reduce((sum, day) => sum + day.loggedMeals, 0) / loggedDays.length) * 10) / 10 : 0;
  const calorieConsistencyDays = weeklyDays.filter((day) => day.logged && Math.abs(day.calories - profile.dailyCalorieGoal) <= profile.dailyCalorieGoal * 0.12).length;
  const proteinConsistencyDays = weeklyDays.filter((day) => day.logged && day.protein >= profile.proteinGoal * 0.85).length;
  const todayTrustedCount = todayMeals.reduce((sum, meal) => sum + (meal.items?.filter((item) => item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE').length ?? 0), 0);
  const todayEstimatedCount = todayMeals.reduce((sum, meal) => sum + ((meal.items?.length ?? 0) - (meal.items?.filter((item) => item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE').length ?? 0)), 0);
  const trustSummary = summarizeTrustCounts(todayTrustedCount, todayEstimatedCount);
  const remainingCalories = calculateRemainingCalories(todayTotals.calories, profile.dailyCalorieGoal);

  return {
    dailyOverview: {
      caloriesEaten: Math.round(todayTotals.calories),
      remainingCalories,
      mealsLogged: todayMeals.length,
      proteinProgress: {
        current: Math.round(todayTotals.protein),
        goal: profile.proteinGoal,
        percent: toProgressValue(todayTotals.protein, profile.proteinGoal),
      },
      trustCoverage: {
        percent: trustSummary.coveragePercent,
        totalCount: trustSummary.totalCount,
        summary: trustSummary.totalCount ? trustSummary.coverageSummary : 'No meals logged yet',
        estimatedSummary: trustSummary.estimatedSummary,
      },
      macroBalance: computeMacroBalanceLabel(todayTotals.calories, todayTotals.protein, todayTotals.carbs, todayTotals.fat),
      loggingStreak,
    },
    weeklyTrends: {
      chart: weeklyDays.map((day) => ({ date: day.date, calories: day.calories, goal: profile.dailyCalorieGoal })),
      loggingDays: `${loggedDays.length} of 7 days logged`,
      calorieConsistency: `${calorieConsistencyDays} of 7 days near target`,
      proteinConsistency: `${proteinConsistencyDays} of 7 days near protein target`,
      averageCalories: loggedDays.length ? `${averageCalories} avg calories` : 'No weekly average yet',
      averageProtein: loggedDays.length ? `${averageProtein}g avg protein` : 'No protein trend yet',
      averageMealsPerDay: loggedDays.length ? `${averageMealsPerDay} meals per logged day` : 'No repeat pace yet',
      topMealType: getTopMealType(weeklyDays),
    },
    patternCards: buildPatternCards(weeklyDays, profile, remainingCalories),
  };
}

export async function getInsightsData(inputDate: Date | string = new Date()) {
  const user = await getCurrentUserWithProfile();

  if (!user || !user.profile) {
    return null;
  }

  const date = startOfDayUtc(inputDate);
  const sevenDaysAgo = getPastSevenDays(date)[0] ?? date;

  const [todayMeals, weeklyMeals] = await Promise.all([
    prisma.meal.findMany({
      where: {
        userId: user.id,
        date: date,
      },
      select: {
        date: true,
        mealType: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        totalFiber: true,
        totalSugar: true,
        totalSodium: true,
        items: {
          select: {
            nutritionSourceType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.meal.findMany({
      where: {
        userId: user.id,
        date: {
          gte: sevenDaysAgo,
          lte: date,
        },
      },
      select: {
        date: true,
        mealType: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        totalFiber: true,
        totalSugar: true,
        totalSodium: true,
        items: {
          select: {
            nutritionSourceType: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
    },
    profile: user.profile,
    ...buildInsightsViewModel({
      currentDate: date,
      profile: user.profile,
      todayMeals,
      weeklyMeals,
    }),
  };
}
