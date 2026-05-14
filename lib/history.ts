import type { ParsedFoodItem } from '@/lib/ai/types';
import { getCurrentUserId } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { isoDay } from '@/lib/date';
import { summarizeStoredItems } from '@/lib/trust';

export type MealHistoryEntry = {
  id: string;
  title: string;
  mealType: string;
  time: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  trustedCount: number;
  estimatedCount: number;
};

export type MealHistoryGroup = {
  date: string;
  meals: MealHistoryEntry[];
};

export type RecentMealQuickLog = {
  id: string;
  title: string;
  mealType: string;
  totalCalories: number;
  date?: string;
  createdAt: string;
  rawText: string | null;
  confidenceScore: number;
  items: ParsedFoodItem[];
};

export async function getMealHistory(): Promise<MealHistoryGroup[]> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const meals = await prisma.meal.findMany({
    where: { userId },
    include: { items: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 40,
  });

  const grouped = new Map<string, MealHistoryEntry[]>();

  for (const meal of meals) {
    const key = isoDay(meal.date);
    const summary = summarizeStoredItems(meal.items);
    const title = meal.rawText || `${meal.items.length} item meal`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)?.push({
      id: meal.id,
      title,
      mealType: meal.mealType.toLowerCase(),
      time: meal.createdAt.toISOString(),
      totalCalories: Math.round(meal.totalCalories),
      totalProtein: Math.round(meal.totalProtein),
      totalCarbs: Math.round(meal.totalCarbs),
      totalFat: Math.round(meal.totalFat),
      trustedCount: summary.trustedCount,
      estimatedCount: summary.estimatedCount,
    });
  }

  return Array.from(grouped.entries()).map(([date, mealsForDay]) => ({
    date,
    meals: mealsForDay,
  }));
}

export async function getRecentMealsForQuickLog(limit = 6): Promise<RecentMealQuickLog[]> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const meals = await prisma.meal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      mealType: true,
      date: true,
      rawText: true,
      confidenceScore: true,
      totalCalories: true,
      createdAt: true,
      items: {
        select: {
          foodName: true,
          quantity: true,
          unit: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          fiber: true,
          sugar: true,
          sodium: true,
          notes: true,
          nutritionSourceType: true,
          nutritionSourceName: true,
          catalogFoodId: true,
        },
      },
    },
  });

  return meals.map((meal) => ({
    id: meal.id,
    title: meal.rawText || `${meal.items.length} item meal`,
    mealType: meal.mealType.toLowerCase(),
    totalCalories: Math.round(meal.totalCalories),
    date: meal.date.toISOString(),
    createdAt: meal.createdAt.toISOString(),
    rawText: meal.rawText,
    confidenceScore: meal.confidenceScore ?? 0.82,
    items: meal.items.map((item) => ({
      food_name: item.foodName,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      notes: item.notes ?? null,
      is_trusted: item.nutritionSourceType !== 'AI_ESTIMATE',
      source_type: item.nutritionSourceType ?? null,
      source_name: item.nutritionSourceName ?? null,
      catalog_food_id: item.catalogFoodId ?? null,
    })),
  }));
}
