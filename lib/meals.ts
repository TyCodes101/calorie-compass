import { MealType } from '@prisma/client';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { upsertDailyLogForDate } from '@/lib/dashboard';
import { startOfDayUtc } from '@/lib/date';
import { sanitizeNumber, sumNutrition } from '@/lib/nutrition';
import { logConnectionReady, logWriteFailure, logWriteStart, logWriteSuccess } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';

export type SaveMealPayload = {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  confidence_score: number;
  raw_text?: string | null;
  notes?: string | null;
  date?: string;
  source_reusable_meal_id?: string | null;
  items: ParsedFoodItem[];
};

function toMealType(value: SaveMealPayload['meal_type']) {
  return value.toUpperCase() as MealType;
}

export async function saveConfirmedMeal(payload: SaveMealPayload) {
  const user = await getCurrentUserWithProfile();

  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  if (!payload.items.length) {
    throw new Error('Meal must include at least one item.');
  }

  const date = startOfDayUtc(payload.date ?? new Date());
  const mealType = toMealType(payload.meal_type);
  const normalizedItems = payload.items.map((item) => ({
    foodName: item.food_name,
    quantity: sanitizeNumber(item.quantity || 1),
    unit: item.unit || 'serving',
    calories: sanitizeNumber(item.calories),
    protein: sanitizeNumber(item.protein),
    carbs: sanitizeNumber(item.carbs),
    fat: sanitizeNumber(item.fat),
    fiber: sanitizeNumber(item.fiber),
    sugar: sanitizeNumber(item.sugar),
    sodium: sanitizeNumber(item.sodium),
    mealType,
    date,
    confidenceScore: sanitizeNumber(payload.confidence_score),
    notes: item.notes ?? null,
    nutritionSourceType: item.source_type ?? null,
    nutritionSourceName: item.source_name ?? null,
    catalogFoodId: item.catalog_food_id ?? null,
  }));

  const totals = sumNutrition(normalizedItems);

  logWriteStart('meal.save', {
    userId: user.id,
    mealType,
    itemCount: normalizedItems.length,
    sourceReusableMealId: payload.source_reusable_meal_id ?? null,
  });

  try {
    await prisma.$connect();
    logConnectionReady('meal.save', {
      userId: user.id,
      mealType,
    });

    const meal = await prisma.$transaction(async (tx) => {
      const createdMeal = await tx.meal.create({
        data: {
          userId: user.id,
          mealType,
          date,
          rawText: payload.raw_text ?? null,
          notes: payload.notes ?? null,
          confidenceScore: sanitizeNumber(payload.confidence_score),
          totalCalories: totals.calories,
          totalProtein: totals.protein,
          totalCarbs: totals.carbs,
          totalFat: totals.fat,
          totalFiber: totals.fiber,
          totalSugar: totals.sugar,
          totalSodium: totals.sodium,
          items: {
            create: normalizedItems,
          },
        },
        include: { items: true },
      });

      await upsertDailyLogForDate(user.id, date, tx);

      if (payload.source_reusable_meal_id) {
        await tx.reusableMeal.updateMany({
          where: {
            id: payload.source_reusable_meal_id,
            userId: user.id,
          },
          data: {
            lastUsedAt: new Date(),
          },
        });
      }

      return createdMeal;
    });

    logWriteSuccess('meal.save', {
      userId: user.id,
      mealId: meal.id,
      totalCalories: meal.totalCalories,
      itemCount: meal.items.length,
    });

    return meal;
  } catch (error) {
    logWriteFailure('meal.save', error, {
      userId: user.id,
      mealType,
      itemCount: normalizedItems.length,
    });
    throw error;
  }
}
