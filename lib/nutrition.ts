export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
};

export type NutritionLike = Partial<NutritionTotals>;

export const zeroTotals = (): NutritionTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
});

export function sanitizeNumber(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
}

export function sumNutrition(items: NutritionLike[]) {
  return items.reduce<NutritionTotals>((acc, item) => ({
    calories: acc.calories + sanitizeNumber(item.calories),
    protein: acc.protein + sanitizeNumber(item.protein),
    carbs: acc.carbs + sanitizeNumber(item.carbs),
    fat: acc.fat + sanitizeNumber(item.fat),
    fiber: acc.fiber + sanitizeNumber(item.fiber),
    sugar: acc.sugar + sanitizeNumber(item.sugar),
    sodium: acc.sodium + sanitizeNumber(item.sodium),
  }), zeroTotals());
}

export function calculateRemainingCalories(consumed: number, goal: number) {
  return Math.max(0, Math.round(goal - consumed));
}

export function toProgressValue(current: number, goal: number) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}
