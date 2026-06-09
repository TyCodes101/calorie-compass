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
};

function round(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function daysInWindow(currentDate: Date | string, length: number) {
  const start = addDaysUtc(currentDate, -(length - 1));
  return Array.from({ length }, (_, index) => isoDay(addDaysUtc(start, index)));
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
  const loggedDays = weekDays.map((day) => ({ day, totals: byDay.get(day) })).filter((entry) => entry.totals);

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
  };
}

