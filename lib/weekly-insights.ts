import { addDaysUtc, isoDay, startOfDayUtc } from '@/lib/date';

export type WeeklyInsightInputMeal = {
  date: Date | string;
  totalCalories: number;
  totalProtein: number;
};

export type WeeklyInsights = {
  daysLogged: number;
  averageCalories: number;
  averageProtein: number;
  bestProteinDay: { date: string; protein: number } | null;
  highestCalorieDay: { date: string; calories: number } | null;
  consistencyScore: number;
  calorieTrend: WeeklyTrendComparison;
  proteinTrend: WeeklyTrendComparison;
};

export type WeeklyTrendComparison = {
  direction: 'up' | 'down' | 'flat' | 'none';
  delta: number;
  summary: string;
};

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function daysInWindow(currentDate: Date | string, length: number) {
  const start = addDaysUtc(currentDate, -(length - 1));
  return Array.from({ length }, (_, index) => isoDay(addDaysUtc(start, index)));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function scoreConsistency(values: number[]) {
  if (values.length <= 1) return values.length ? 100 : 0;
  const avg = average(values);
  if (avg <= 0) return 0;
  const averageDeviation = average(values.map((value) => Math.abs(value - avg)));
  return Math.max(0, Math.min(100, round(100 - (averageDeviation / avg) * 100)));
}

function buildTrendComparison(label: 'Calories' | 'Protein', unit: '/day' | 'g/day', currentValues: number[], previousValues: number[]): WeeklyTrendComparison {
  const verb = label === 'Protein' ? 'is' : 'are';
  if (!currentValues.length || !previousValues.length) {
    return {
      direction: 'none',
      delta: 0,
      summary: `No ${label.toLowerCase()} comparison yet.`,
    };
  }

  const delta = round(average(currentValues) - average(previousValues));
  const direction = Math.abs(delta) <= 1 ? 'flat' : delta > 0 ? 'up' : 'down';

  if (direction === 'flat') {
    return {
      direction,
      delta: 0,
      summary: `${label} ${verb} steady vs last week.`,
    };
  }

  return {
    direction,
    delta: Math.abs(delta),
    summary: `${label} ${verb} ${direction} ${Math.abs(delta)}${unit} vs last week.`,
  };
}

export function buildWeeklyInsights(options: { currentDate?: Date | string; meals: WeeklyInsightInputMeal[] }): WeeklyInsights {
  const currentDate = startOfDayUtc(options.currentDate ?? new Date());
  const byDay = new Map<string, { calories: number; protein: number }>();

  for (const meal of options.meals) {
    const key = isoDay(meal.date);
    const current = byDay.get(key) ?? { calories: 0, protein: 0 };
    current.calories += meal.totalCalories;
    current.protein += meal.totalProtein;
    byDay.set(key, current);
  }

  const weekDays = daysInWindow(currentDate, 7);
  const previousWeekDays = daysInWindow(addDaysUtc(currentDate, -7), 7);
  const loggedDays = weekDays.map((day) => ({ day, totals: byDay.get(day) })).filter((entry) => entry.totals);
  const previousLoggedDays = previousWeekDays.map((day) => ({ day, totals: byDay.get(day) })).filter((entry) => entry.totals);
  const currentCalories = loggedDays.map((entry) => entry.totals?.calories ?? 0);
  const currentProtein = loggedDays.map((entry) => entry.totals?.protein ?? 0);
  const previousCalories = previousLoggedDays.map((entry) => entry.totals?.calories ?? 0);
  const previousProtein = previousLoggedDays.map((entry) => entry.totals?.protein ?? 0);

  const daysLogged = loggedDays.length;
  const averageCalories = daysLogged ? round(loggedDays.reduce((sum, entry) => sum + (entry.totals?.calories ?? 0), 0) / daysLogged) : 0;
  const averageProtein = daysLogged ? round(loggedDays.reduce((sum, entry) => sum + (entry.totals?.protein ?? 0), 0) / daysLogged) : 0;

  const bestProteinDay = loggedDays.reduce<{ date: string; protein: number } | null>((best, entry) => {
    const protein = round(entry.totals?.protein ?? 0);
    return !best || protein > best.protein ? { date: entry.day, protein } : best;
  }, null);

  const highestCalorieDay = loggedDays.reduce<{ date: string; calories: number } | null>((best, entry) => {
    const calories = round(entry.totals?.calories ?? 0);
    return !best || calories > best.calories ? { date: entry.day, calories } : best;
  }, null);

  return {
    daysLogged,
    averageCalories,
    averageProtein,
    bestProteinDay,
    highestCalorieDay,
    consistencyScore: round((scoreConsistency(currentCalories) + scoreConsistency(currentProtein)) / 2),
    calorieTrend: buildTrendComparison('Calories', '/day', currentCalories, previousCalories),
    proteinTrend: buildTrendComparison('Protein', 'g/day', currentProtein, previousProtein),
  };
}

