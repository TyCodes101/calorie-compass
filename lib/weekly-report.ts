import { addDaysUtc, isoDay } from '@/lib/date';

type WeeklyReportMeal = {
  date: Date | string;
  mealType?: string | null;
  totalCalories: number;
  totalProtein: number;
};

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function mealTypeLabel(mealType: string | null | undefined) {
  const normalized = mealType?.trim().toLowerCase();
  if (!normalized) return 'snack';
  return normalized;
}

export function buildWeeklyReport({
  currentDate = new Date(),
  meals,
  calorieGoal,
  proteinGoal,
}: {
  currentDate?: Date | string;
  meals: WeeklyReportMeal[];
  calorieGoal: number;
  proteinGoal: number;
}) {
  const end = isoDay(currentDate);
  const start = isoDay(addDaysUtc(currentDate, -6));
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const endTime = new Date(`${end}T23:59:59.999Z`).getTime();
  const weeklyMeals = meals.filter((meal) => {
    const time = new Date(meal.date).getTime();
    return time >= startTime && time <= endTime;
  });
  const byDay = new Map<string, { calories: number; protein: number; meals: number }>();
  const mealTypeCounts = new Map<string, number>();

  for (const meal of weeklyMeals) {
    const day = isoDay(meal.date);
    const totals = byDay.get(day) ?? { calories: 0, protein: 0, meals: 0 };
    totals.calories += meal.totalCalories;
    totals.protein += meal.totalProtein;
    totals.meals += 1;
    byDay.set(day, totals);
    const type = mealTypeLabel(meal.mealType);
    mealTypeCounts.set(type, (mealTypeCounts.get(type) ?? 0) + 1);
  }

  const loggedDays = Array.from(byDay.values());
  const mealCount = weeklyMeals.length;
  const averageCalories = loggedDays.length ? round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length) : 0;
  const averageProtein = loggedDays.length ? round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length) : 0;
  const calorieTargetDays = loggedDays.filter((day) => Math.abs(day.calories - calorieGoal) <= calorieGoal * 0.15).length;
  const proteinTargetDays = loggedDays.filter((day) => day.protein >= proteinGoal).length;
  const topMealType = Array.from(mealTypeCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  if (!mealCount) {
    return {
      startDate: start,
      endDate: end,
      loggedDays: 0,
      mealCount: 0,
      averageCalories: 0,
      averageProtein: 0,
      calorieTargetDays: 0,
      proteinTargetDays: 0,
      topMealType: null,
      summary: 'No weekly report yet',
      highlights: ['Log a few meals this week to unlock a useful report.'],
    };
  }

  const highlights = [
    `${proteinTargetDays} days hit your protein goal.`,
    `${calorieTargetDays} days stayed near your calorie target.`,
  ];
  if (topMealType) {
    highlights.push(`${topMealType} was your most logged meal type.`);
  }

  return {
    startDate: start,
    endDate: end,
    loggedDays: byDay.size,
    mealCount,
    averageCalories,
    averageProtein,
    calorieTargetDays,
    proteinTargetDays,
    topMealType,
    summary: `${byDay.size} of 7 days logged with ${mealCount} meals total.`,
    highlights,
  };
}
