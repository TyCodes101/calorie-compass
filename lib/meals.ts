import { MealType, Prisma } from '@prisma/client';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { getPersistableCatalogFoodIds } from '@/lib/catalog-persistence';
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
  pending_meal_id?: string | null;
  pending_meal_version?: number | null;
  idempotency_key?: string | null;
  items: ParsedFoodItem[];
};

export class DuplicateMealSaveError extends Error {
  constructor(readonly existingMealId: string) {
    super('Meal was already saved for this pending review.');
    this.name = 'DuplicateMealSaveError';
  }
}

function toMealType(value: SaveMealPayload['meal_type']) {
  return value.toUpperCase() as MealType;
}

function normalizeIdempotencyKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildStoredItemNotes(item: ParsedFoodItem) {
  const baseNotes = item.notes?.trim() || '';
  const traceParts = [
    item.original_user_text ? `input=${item.original_user_text}` : null,
    item.matched_query ? `matched=${item.matched_query}` : null,
    item.provider_used ? `provider=${item.provider_used}` : null,
    item.providerCandidateId ? `candidate=${item.providerCandidateId}` : null,
    item.confidence_label ? `confidence=${item.confidence_label}` : null,
    item.requested_modifiers?.length ? `modifiers=${item.requested_modifiers.join(';')}` : null,
    item.modifier_resolution ? `modifierResolution=${item.modifier_resolution}` : null,
    item.review_status ? `reviewStatus=${item.review_status}` : null,
    typeof item.used_ai_fallback === 'boolean' ? `aiFallback=${item.used_ai_fallback ? 'yes' : 'no'}` : null,
  ].filter(Boolean);

  if (!traceParts.length) {
    return baseNotes || null;
  }

  const traceText = `Trace: ${traceParts.join(' | ')}`;
  return baseNotes ? `${baseNotes}\n\n${traceText}` : traceText;
}

async function normalizeMealPayload(payload: SaveMealPayload) {
  const date = startOfDayUtc(payload.date ?? new Date());
  const mealType = toMealType(payload.meal_type);
  const persistableCatalogFoodIds = await getPersistableCatalogFoodIds(payload.items.map((item) => item.catalog_food_id ?? null));
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
    notes: buildStoredItemNotes(item),
    nutritionSourceType: item.source_type ?? null,
    nutritionSourceName: item.source_name ?? null,
    catalogFoodId: item.catalog_food_id && persistableCatalogFoodIds.has(item.catalog_food_id) ? item.catalog_food_id : null,
  }));

  return {
    date,
    mealType,
    normalizedItems,
    totals: sumNutrition(normalizedItems),
  };
}

export async function saveConfirmedMeal(payload: SaveMealPayload) {
  const user = await getCurrentUserWithProfile();

  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  if (!payload.items.length) {
    throw new Error('Meal must include at least one item.');
  }

  const { date, mealType, normalizedItems, totals } = await normalizeMealPayload(payload);
  const idempotencyKey = normalizeIdempotencyKey(payload.idempotency_key);

  logWriteStart('meal.save', {
    userId: user.id,
    mealType,
    itemCount: normalizedItems.length,
    sourceReusableMealId: payload.source_reusable_meal_id ?? null,
    pendingMealId: payload.pending_meal_id ?? null,
    idempotencyKey,
  });

  try {
    await prisma.$connect();
    logConnectionReady('meal.save', {
      userId: user.id,
      mealType,
    });

    const meal = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existingMeal = await tx.meal.findFirst({
          where: {
            userId: user.id,
            idempotencyKey,
          },
          select: { id: true },
        });

        if (existingMeal) {
          throw new DuplicateMealSaveError(existingMeal.id);
        }
      }

      const createdMeal = await tx.meal.create({
        data: {
          userId: user.id,
          mealType,
          date,
          rawText: payload.raw_text ?? null,
          notes: payload.notes ?? null,
          pendingMealId: payload.pending_meal_id?.trim() || null,
          pendingMealVersion: typeof payload.pending_meal_version === 'number' ? payload.pending_meal_version : null,
          idempotencyKey,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && idempotencyKey) {
      const existingMeal = await prisma.meal.findFirst({
        where: {
          userId: user.id,
          idempotencyKey,
        },
        select: { id: true },
      });
      if (existingMeal) {
        throw new DuplicateMealSaveError(existingMeal.id);
      }
    }

    logWriteFailure('meal.save', error, {
      userId: user.id,
      mealType,
      itemCount: normalizedItems.length,
      pendingMealId: payload.pending_meal_id ?? null,
      idempotencyKey,
    });
    throw error;
  }
}

export async function updateSavedMeal(mealId: string, payload: SaveMealPayload) {
  const user = await getCurrentUserWithProfile();

  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  if (!payload.items.length) {
    throw new Error('Meal must include at least one item.');
  }

  const existingMeal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId: user.id,
    },
    select: {
      id: true,
      date: true,
    },
  });

  if (!existingMeal) {
    throw new Error('Meal not found.');
  }

  const { date, mealType, normalizedItems, totals } = await normalizeMealPayload({
    ...payload,
    date: payload.date ?? existingMeal.date.toISOString(),
  });

  logWriteStart('meal.update', {
    userId: user.id,
    mealId,
    mealType,
    itemCount: normalizedItems.length,
  });

  try {
    await prisma.$connect();
    logConnectionReady('meal.update', {
      userId: user.id,
      mealId,
    });

    const meal = await prisma.$transaction(async (tx) => {
      const updatedMeal = await tx.meal.update({
        where: { id: existingMeal.id },
        data: {
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
            deleteMany: {},
            create: normalizedItems,
          },
        },
        include: { items: true },
      });

      await upsertDailyLogForDate(user.id, existingMeal.date, tx);

      if (existingMeal.date.getTime() !== date.getTime()) {
        await upsertDailyLogForDate(user.id, date, tx);
      }

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

      return updatedMeal;
    });

    logWriteSuccess('meal.update', {
      userId: user.id,
      mealId: meal.id,
      itemCount: meal.items.length,
      totalCalories: meal.totalCalories,
    });

    return meal;
  } catch (error) {
    logWriteFailure('meal.update', error, {
      userId: user.id,
      mealId,
      itemCount: normalizedItems.length,
    });
    throw error;
  }
}

export async function deleteSavedMeal(mealId: string) {
  const user = await getCurrentUserWithProfile();

  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  const existingMeal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      userId: user.id,
    },
    select: {
      id: true,
      date: true,
      rawText: true,
    },
  });

  if (!existingMeal) {
    throw new Error('Meal not found.');
  }

  logWriteStart('meal.delete', {
    userId: user.id,
    mealId,
  });

  try {
    await prisma.$connect();
    logConnectionReady('meal.delete', {
      userId: user.id,
      mealId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.meal.delete({
        where: { id: existingMeal.id },
      });

      await upsertDailyLogForDate(user.id, existingMeal.date, tx);
    });

    logWriteSuccess('meal.delete', {
      userId: user.id,
      mealId,
    });

    return {
      id: existingMeal.id,
      rawText: existingMeal.rawText,
      date: existingMeal.date,
    };
  } catch (error) {
    logWriteFailure('meal.delete', error, {
      userId: user.id,
      mealId,
    });
    throw error;
  }
}
