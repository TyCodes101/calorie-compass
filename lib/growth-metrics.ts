import { addDaysUtc, isoDay, startOfDayUtc } from '@/lib/date';

type MealMetric = {
  date: Date | string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs?: number;
  totalFat?: number;
};

type GoalTypeValue = 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_MUSCLE';
type ActivityLevelValue = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
type ProteinPreference = 'moderate' | 'high';

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function groupMealsByDay(meals: MealMetric[]) {
  const days = new Map<string, { calories: number; protein: number; carbs: number; fat: number; meals: number }>();

  for (const meal of meals) {
    const key = isoDay(meal.date);
    const current = days.get(key) ?? { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
    current.calories += meal.totalCalories;
    current.protein += meal.totalProtein;
    current.carbs += meal.totalCarbs ?? 0;
    current.fat += meal.totalFat ?? 0;
    current.meals += 1;
    days.set(key, current);
  }

  return days;
}

function computeLongestStreakFromDays(days: string[]) {
  const sorted = Array.from(new Set(days)).sort();
  let best = 0;
  let current = 0;
  let last: string | null = null;

  for (const day of sorted) {
    if (!last) {
      current = 1;
      best = Math.max(best, current);
      last = day;
      continue;
    }

    const lastDate = new Date(`${last}T00:00:00.000Z`).getTime();
    const dayDate = new Date(`${day}T00:00:00.000Z`).getTime();
    if (dayDate - lastDate === 86400000) {
      current += 1;
    } else {
      current = 1;
    }

    best = Math.max(best, current);
    last = day;
  }

  return best;
}

function daysInWindow(currentDate: Date | string, length: number) {
  const start = addDaysUtc(currentDate, -(length - 1));
  return Array.from({ length }, (_, index) => isoDay(addDaysUtc(start, index)));
}

export function buildStreakMilestone(currentStreakDays: number) {
  const streak = Math.max(0, Math.floor(Number.isFinite(currentStreakDays) ? currentStreakDays : 0));
  const milestones = [3, 7, 14, 30, 60, 100];
  const nextMilestone = milestones.find((milestone) => milestone > streak) ?? null;
  const achievedMilestone = [...milestones].reverse().find((milestone) => milestone <= streak) ?? null;

  if (!nextMilestone) {
    return {
      achievedMilestone,
      nextMilestone: null,
      daysUntilNext: 0,
      progressPercent: 100,
      message: '100-day streak reached. Keep the rhythm steady.',
    };
  }

  const daysUntilNext = nextMilestone - streak;
  const progressPercent = Math.max(0, Math.min(100, Math.round((streak / nextMilestone) * 100)));
  const halfway = streak >= Math.ceil(nextMilestone / 2) && daysUntilNext > 2;

  return {
    achievedMilestone,
    nextMilestone,
    daysUntilNext,
    progressPercent,
    message: halfway
      ? `You're halfway to a ${nextMilestone}-day streak.`
      : `${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'} until your ${nextMilestone}-day streak.`,
  };
}

export function buildDashboardStreaks({
  currentDate = new Date(),
  meals,
  proteinGoal,
}: {
  currentDate?: Date | string;
  meals: MealMetric[];
  proteinGoal: number;
}) {
  const byDay = groupMealsByDay(meals);
  const week = daysInWindow(currentDate, 7);
  let currentStreakDays = 0;

  for (let day = startOfDayUtc(currentDate); ; day = addDaysUtc(day, -1)) {
    if (!byDay.has(isoDay(day))) break;
    currentStreakDays += 1;
  }

  const mealsLoggedThisWeek = week.reduce((sum, day) => sum + (byDay.get(day)?.meals ?? 0), 0);
  const proteinGoalHitDaysThisWeek = week.filter((day) => (byDay.get(day)?.protein ?? 0) >= proteinGoal * 0.85).length;
  const longestStreakDays = computeLongestStreakFromDays(Array.from(byDay.keys()));

  return {
    currentStreakDays,
    longestStreakDays,
    mealsLoggedThisWeek,
    proteinGoalHitDaysThisWeek,
    milestone: buildStreakMilestone(currentStreakDays),
    summary: currentStreakDays > 0 ? `${currentStreakDays} day streak` : 'Start a logging streak today',
  };
}

export function buildNutritionAnalytics({
  currentDate = new Date(),
  meals,
  calorieGoal,
  proteinGoal,
}: {
  currentDate?: Date | string;
  meals: MealMetric[];
  calorieGoal: number;
  proteinGoal: number;
}) {
  const byDay = groupMealsByDay(meals);
  const sevenLogged = daysInWindow(currentDate, 7).map((day) => ({ day, totals: byDay.get(day) })).filter((entry) => entry.totals);
  const thirtyLogged = daysInWindow(currentDate, 30).map((day) => ({ day, totals: byDay.get(day) })).filter((entry) => entry.totals);
  const sevenDayAverageCalories = sevenLogged.length ? round(sevenLogged.reduce((sum, entry) => sum + (entry.totals?.calories ?? 0), 0) / sevenLogged.length) : 0;
  const sevenDayAverageProtein = sevenLogged.length ? round(sevenLogged.reduce((sum, entry) => sum + (entry.totals?.protein ?? 0), 0) / sevenLogged.length) : 0;
  const thirtyDayAverageCalories = thirtyLogged.length ? round(thirtyLogged.reduce((sum, entry) => sum + (entry.totals?.calories ?? 0), 0) / thirtyLogged.length) : 0;
  const highestProteinDay = thirtyLogged.reduce<{ date: string; protein: number } | null>((best, entry) => {
    const protein = round(entry.totals?.protein ?? 0);
    return !best || protein > best.protein ? { date: entry.day, protein } : best;
  }, null);
  const calorieConsistentDays = sevenLogged.filter((entry) => Math.abs((entry.totals?.calories ?? 0) - calorieGoal) <= calorieGoal * 0.15).length;
  const proteinConsistentDays = sevenLogged.filter((entry) => (entry.totals?.protein ?? 0) >= proteinGoal * 0.85).length;

  return {
    sevenDayAverageCalories,
    sevenDayAverageProtein,
    thirtyDayAverageCalories,
    highestProteinDay,
    macroConsistencySummary: sevenLogged.length
      ? `${proteinConsistentDays} protein days, ${calorieConsistentDays} calorie-consistent days this week`
      : 'No analytics yet',
  };
}

export function calculateGoalTargets({
  weightLbs,
  goalWeightLbs,
  goal,
  activityLevel,
  ratePerWeekLbs = 0,
  proteinPreference = 'moderate',
}: {
  weightLbs: number;
  goalWeightLbs?: number | null;
  goal: GoalTypeValue;
  activityLevel: ActivityLevelValue;
  ratePerWeekLbs?: number;
  proteinPreference?: ProteinPreference;
}) {
  const activityMultiplier = {
    LOW: 13,
    MODERATE: 15,
    HIGH: 17,
    VERY_HIGH: 19,
  }[activityLevel];
  const maintenanceCalories = weightLbs * activityMultiplier;
  const weeklyAdjustment = Math.min(Math.max(ratePerWeekLbs, 0), 2) * 500;
  const targetDelta = typeof goalWeightLbs === 'number' && Number.isFinite(goalWeightLbs) ? goalWeightLbs - weightLbs : null;
  const shouldAdjustForGoal =
    targetDelta === null ||
    (goal === 'LOSE_WEIGHT' && targetDelta < -0.5) ||
    (goal === 'GAIN_MUSCLE' && targetDelta > 0.5);
  const directionAdjustment = shouldAdjustForGoal
    ? goal === 'LOSE_WEIGHT'
      ? -weeklyAdjustment
      : goal === 'GAIN_MUSCLE'
        ? weeklyAdjustment * 0.65
        : 0
    : 0;
  const dailyCalorieGoal = Math.max(1500, round(maintenanceCalories + directionAdjustment));
  const proteinPerPound = proteinPreference === 'high' || goal !== 'MAINTAIN' ? 0.9 : 0.75;
  const proteinGoal = round(weightLbs * proteinPerPound);
  const fatGoal = Math.max(45, round((dailyCalorieGoal * 0.25) / 9));
  const carbsGoal = Math.max(0, round((dailyCalorieGoal - proteinGoal * 4 - fatGoal * 9) / 4));

  return {
    dailyCalorieGoal,
    proteinGoal,
    carbsGoal,
    fatGoal,
  };
}

export function summarizeWeightTrend(entries: Array<{ date: Date | string; weightLbs: number }>) {
  const ordered = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = ordered[0];
  const oldest = ordered[ordered.length - 1];
  const changeLbs = latest && oldest ? Math.round((latest.weightLbs - oldest.weightLbs) * 10) / 10 : 0;

  return {
    latestWeightLbs: latest?.weightLbs ?? null,
    changeLbs,
    direction: changeLbs < 0 ? 'down' : changeLbs > 0 ? 'up' : 'flat',
  };
}
