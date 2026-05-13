import { ActivityLevel } from '@prisma/client';

import { getPastSevenDays, isoDay, startOfDayUtc } from '@/lib/date';
import { sumMealTotals } from '@/lib/dashboard-aggregation';
import { toProgressValue } from '@/lib/nutrition';
import { prisma } from '@/lib/prisma';

type MealLike = {
  date: Date;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber?: number;
  totalSugar?: number;
  totalSodium?: number;
};

type WeightLike = {
  date: Date;
  weightLbs: number;
};

type ProfileLike = {
  dailyCalorieGoal: number;
  proteinGoal: number;
  activityLevel: ActivityLevel;
};

type InsightCardTone = 'live' | 'preview' | 'tip';

const ACTIVITY_BURN_BASELINE: Record<ActivityLevel, number> = {
  LOW: 160,
  MODERATE: 260,
  HIGH: 360,
  VERY_HIGH: 460,
};

function buildDaysWithTotals(meals: MealLike[], inputDate: Date | string) {
  const totalsByDay = new Map<string, ReturnType<typeof sumMealTotals>>();

  for (const day of getPastSevenDays(inputDate)) {
    totalsByDay.set(isoDay(day), sumMealTotals([]));
  }

  for (const meal of meals) {
    const key = isoDay(meal.date);
    const current = totalsByDay.get(key) ?? sumMealTotals([]);

    totalsByDay.set(key, {
      calories: current.calories + meal.totalCalories,
      protein: current.protein + meal.totalProtein,
      carbs: current.carbs + meal.totalCarbs,
      fat: current.fat + meal.totalFat,
      fiber: current.fiber,
      sugar: current.sugar,
      sodium: current.sodium,
    });
  }

  return getPastSevenDays(inputDate).map((day) => {
    const key = isoDay(day);
    const totals = totalsByDay.get(key) ?? sumMealTotals([]);

    return {
      date: key,
      ...totals,
      logged: totals.calories > 0,
    };
  });
}

function sumInsightMealTotals(meals: MealLike[]) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
      fiber: acc.fiber + (meal.totalFiber ?? 0),
      sugar: acc.sugar + (meal.totalSugar ?? 0),
      sodium: acc.sodium + (meal.totalSodium ?? 0),
    }),
    sumMealTotals([]),
  );
}

function formatSignedCalories(value: number) {
  if (value === 0) return 'On target';
  return `${value > 0 ? '+' : ''}${value} kcal/day`;
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

function computeLoggingStreak(days: Array<{ logged: boolean }>) {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (!days[index]?.logged) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function buildInsightCards(days: Array<{ date: string; calories: number; protein: number; logged: boolean }>, profile: ProfileLike, todayNetCalories: number) {
  const weekdayDays = days.filter((day) => {
    const weekday = new Date(day.date).getUTCDay();
    return weekday >= 1 && weekday <= 5 && day.logged;
  });
  const weekendDays = days.filter((day) => {
    const weekday = new Date(day.date).getUTCDay();
    return (weekday === 0 || weekday === 6) && day.logged;
  });
  const weekdayProteinAverage = weekdayDays.length
    ? Math.round(weekdayDays.reduce((sum, day) => sum + day.protein, 0) / weekdayDays.length)
    : 0;
  const weekendProteinAverage = weekendDays.length
    ? Math.round(weekendDays.reduce((sum, day) => sum + day.protein, 0) / weekendDays.length)
    : 0;
  const hitCalorieTargetDays = days.filter((day) => day.logged && Math.abs(day.calories - profile.dailyCalorieGoal) <= profile.dailyCalorieGoal * 0.12).length;

  return [
    weekdayDays.length && weekendDays.length
      ? {
          title: 'Protein pattern',
          detail:
            weekdayProteinAverage > weekendProteinAverage
              ? 'You average higher protein on weekdays.'
              : 'Your protein stays steadier than expected across the week.',
          supporting: `${weekdayProteinAverage}g average on weekdays vs ${weekendProteinAverage}g on weekends.`,
          tone: 'live' as InsightCardTone,
        }
      : {
          title: 'Protein pattern preview',
          detail: 'You average higher protein on weekdays.',
          supporting: 'Preview card. This becomes live once there is enough weekday and weekend logging history.',
          tone: 'preview' as InsightCardTone,
        },
    {
      title: 'Activity pattern preview',
      detail: 'Your activity drops on weekends.',
      supporting: 'Preview card. This will turn into a real insight once steps or workouts are connected.',
      tone: 'preview' as InsightCardTone,
    },
    {
      title: 'Calorie target rhythm',
      detail: `You hit your calorie target ${hitCalorieTargetDays} of the last 7 days.`,
      supporting: hitCalorieTargetDays
        ? 'Consistency is usually more useful than chasing a perfect day.'
        : 'As your week fills in, this card will call out stronger calorie consistency.',
      tone: 'live' as InsightCardTone,
    },
    {
      title: 'Daily suggestion',
      detail: 'A short walk today could help balance your net calories.',
      supporting:
        todayNetCalories > profile.dailyCalorieGoal
          ? `Your current estimated net is ${todayNetCalories} calories, which is running above target.`
          : 'Even a short walk can keep the day feeling lighter without turning the app into a fitness tracker first.',
      tone: 'tip' as InsightCardTone,
    },
  ];
}

export function buildInsightsViewModel({
  currentDate = new Date(),
  profile,
  todayMeals,
  weeklyMeals,
  weightEntries = [],
}: {
  currentDate?: Date | string;
  profile: ProfileLike;
  todayMeals: MealLike[];
  weeklyMeals: MealLike[];
  weightEntries?: WeightLike[];
}) {
  const today = startOfDayUtc(currentDate);
  const todayTotals = sumInsightMealTotals(todayMeals);
  const weeklyDays = buildDaysWithTotals(weeklyMeals, today);
  const estimatedBurnedCalories = ACTIVITY_BURN_BASELINE[profile.activityLevel] ?? ACTIVITY_BURN_BASELINE.MODERATE;
  const netCalories = Math.round(todayTotals.calories - estimatedBurnedCalories);
  const calorieConsistencyDays = weeklyDays.filter((day) => day.logged && Math.abs(day.calories - profile.dailyCalorieGoal) <= profile.dailyCalorieGoal * 0.12).length;
  const proteinConsistencyDays = weeklyDays.filter((day) => day.logged && day.protein >= profile.proteinGoal * 0.85).length;
  const averageCalories = Math.round(
    weeklyDays.reduce((sum, day) => sum + day.calories, 0) / Math.max(weeklyDays.length, 1),
  );
  const deficitOrSurplus = averageCalories - profile.dailyCalorieGoal;
  const loggingStreak = computeLoggingStreak(weeklyDays);
  const latestWeight = weightEntries[0]?.weightLbs ?? null;
  const priorWeight = weightEntries[1]?.weightLbs ?? null;
  const weightDelta = latestWeight !== null && priorWeight !== null ? Math.round((latestWeight - priorWeight) * 10) / 10 : null;

  return {
    dailyOverview: {
      steps: 0,
      caloriesEaten: Math.round(todayTotals.calories),
      estimatedBurnedCalories,
      netCalories,
      proteinProgress: {
        current: Math.round(todayTotals.protein),
        goal: profile.proteinGoal,
        percent: toProgressValue(todayTotals.protein, profile.proteinGoal),
      },
      macroBalance: computeMacroBalanceLabel(todayTotals.calories, todayTotals.protein, todayTotals.carbs, todayTotals.fat),
      waterIntake: {
        current: 0,
        goal: 8,
      },
      activeStreaks: {
        movementDays: 0,
        trackingDays: loggingStreak,
      },
    },
    weeklyTrends: {
      chart: weeklyDays.map((day) => ({ date: day.date, calories: Math.round(day.calories), goal: profile.dailyCalorieGoal })),
      calorieConsistency: `${calorieConsistencyDays} of 7 days near target`,
      proteinConsistency: `${proteinConsistencyDays} of 7 days near protein target`,
      workoutFrequency: '0 of 7 days logged',
      stepAverage: '0 steps/day connected',
      estimatedDeficitOrSurplus: formatSignedCalories(deficitOrSurplus),
      weightTrend: latestWeight !== null
        ? weightDelta !== null
          ? `${latestWeight} lb (${weightDelta > 0 ? '+' : ''}${weightDelta} lb)`
          : `${latestWeight} lb`
        : 'Placeholder until weigh-ins are added',
    },
    movementTracking: [
      {
        title: 'Step tracking scaffold',
        metric: '0 connected steps',
        detail: 'Ready for Apple Health or Google Fit step imports once movement syncing is turned on.',
      },
      {
        title: 'Workout logging scaffold',
        metric: '0 workouts logged',
        detail: 'Cardio and strength entries can slot here without changing nutrition as the primary action.',
      },
      {
        title: 'Cardio sessions',
        metric: '0 this week',
        detail: 'Use this space later for walks, runs, cycling, and active energy summaries.',
      },
      {
        title: 'Strength training entries',
        metric: '0 this week',
        detail: 'Future sets, lifts, and volume tracking can support recovery and protein context.',
      },
      {
        title: 'Estimated active calories',
        metric: `${estimatedBurnedCalories} kcal`,
        detail: 'Current baseline estimate uses your selected activity level until step and workout data are connected.',
      },
    ],
    integrations: [
      {
        title: 'Apple Health ready',
        fields: ['Steps', 'Workouts', 'Calories burned', 'Heart rate', 'Active energy'],
      },
      {
        title: 'Google Fit ready',
        fields: ['Steps', 'Workouts', 'Calories burned', 'Heart rate', 'Active energy'],
      },
    ],
    insightCards: buildInsightCards(weeklyDays, profile, netCalories),
  };
}

export async function getInsightsData(inputDate: Date | string = new Date()) {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { profile: true },
  });

  if (!user || !user.profile) {
    return null;
  }

  const date = startOfDayUtc(inputDate);
  const sevenDaysAgo = getPastSevenDays(date)[0] ?? date;

  const [todayMeals, weeklyMeals, weightEntries] = await Promise.all([
    prisma.meal.findMany({
      where: {
        userId: user.id,
        date: date,
      },
      select: {
        date: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
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
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
      },
      orderBy: { date: 'asc' },
    }),
    prisma.weightEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
      take: 2,
      select: {
        date: true,
        weightLbs: true,
      },
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
      profile: {
        dailyCalorieGoal: user.profile.dailyCalorieGoal,
        proteinGoal: user.profile.proteinGoal,
        activityLevel: user.profile.activityLevel,
      },
      todayMeals,
      weeklyMeals,
      weightEntries,
    }),
  };
}
