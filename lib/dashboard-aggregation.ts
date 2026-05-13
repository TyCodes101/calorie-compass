import { getPastSevenDays, isoDay, startOfDayUtc } from '@/lib/date';
import { zeroTotals } from '@/lib/nutrition';

type MealTotalsInput = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodium: number;
};

type DatedMealTotalsInput = MealTotalsInput & {
  date: Date;
};

export function sumMealTotals(meals: MealTotalsInput[]) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalCalories,
      protein: acc.protein + meal.totalProtein,
      carbs: acc.carbs + meal.totalCarbs,
      fat: acc.fat + meal.totalFat,
      fiber: acc.fiber + meal.totalFiber,
      sugar: acc.sugar + meal.totalSugar,
      sodium: acc.sodium + meal.totalSodium,
    }),
    zeroTotals(),
  );
}

export function buildWeeklyTrendFromMeals(meals: DatedMealTotalsInput[], inputDate: Date | string, goal: number) {
  const date = startOfDayUtc(inputDate);
  const totalsByDay = new Map<string, ReturnType<typeof zeroTotals>>();

  for (const meal of meals) {
    const dayKey = isoDay(startOfDayUtc(meal.date));
    const current = totalsByDay.get(dayKey) ?? zeroTotals();

    totalsByDay.set(dayKey, {
      calories: current.calories + meal.totalCalories,
      protein: current.protein + meal.totalProtein,
      carbs: current.carbs + meal.totalCarbs,
      fat: current.fat + meal.totalFat,
      fiber: current.fiber + meal.totalFiber,
      sugar: current.sugar + meal.totalSugar,
      sodium: current.sodium + meal.totalSodium,
    });
  }

  return getPastSevenDays(date).map((day) => {
    const entry = totalsByDay.get(isoDay(day));

    return {
      date: isoDay(day),
      calories: Math.round(entry?.calories ?? 0),
      goal,
    };
  });
}
