import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDashboardData } from '@/lib/dashboard';
import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { DuplicateMealSaveError, saveConfirmedMeal } from '@/lib/meals';
import { mapMealForNative } from '@/lib/native-meals';
import { normalizeNutritionVerificationLabel, nutritionVerificationLabels } from '@/lib/nutrition/verification';
import { prisma } from '@/lib/prisma';
import { getPersistenceErrorMessage, isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';

const parsedItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
  notes: z.string().nullable().optional(),
  is_trusted: z.boolean().optional(),
  source_type: z.enum(['OFFICIAL_RESTAURANT', 'GENERIC_REFERENCE', 'AI_ESTIMATE']).nullable().optional(),
  source_name: z.string().nullable().optional(),
  confidence_label: z.preprocess((value) => (value == null ? value : normalizeNutritionVerificationLabel(value)), z.enum(nutritionVerificationLabels).nullable()).optional(),
  match_type: z.enum(['exact_branded', 'exact_restaurant', 'fuzzy_branded', 'fuzzy_restaurant', 'verified_database', 'generic_estimate', 'ai_estimate', 'unknown']).nullable().optional(),
  matched_query: z.string().nullable().optional(),
  original_user_text: z.string().nullable().optional(),
  provider_used: z.string().nullable().optional(),
  used_ai_fallback: z.boolean().nullable().optional(),
  catalog_food_id: z.string().nullable().optional(),
});

const requestSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence_score: z.number().min(0).max(1),
  raw_text: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  date: z.string().optional(),
  source_reusable_meal_id: z.string().nullable().optional(),
  pending_meal_id: z.string().nullable().optional(),
  pending_meal_version: z.number().int().nonnegative().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  items: z.array(parsedItemSchema).min(1),
});

export async function GET() {
  try {
    const user = await getCurrentUserWithProfile();

    if (!user) {
      return NextResponse.json({ meals: [] });
    }

    if (!hasDatabaseConnectionString()) {
      return NextResponse.json({ meals: [] });
    }

    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { date: 'desc' },
      take: 50,
    });

    return NextResponse.json({ meals: meals.map(mapMealForNative) });
  } catch (error) {
    logWriteFailure('meal.route.get', error);
    return NextResponse.json({ error: 'We couldn’t load your saved meals right now. Please try again.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    if (!hasDatabaseConnectionString()) {
      const dashboard = await getDashboardData(payload.date ?? new Date());
      return NextResponse.json({
        meal: {
          id: `local-${Date.now()}`,
          mealType: payload.meal_type.toUpperCase(),
          rawText: payload.raw_text ?? null,
          confidenceScore: payload.confidence_score,
          items: payload.items,
        },
        dashboard,
        localOnly: true,
      });
    }

    const meal = await saveConfirmedMeal(payload);
    const dashboard = await getDashboardData(payload.date ?? new Date());

    return NextResponse.json({ meal: mapMealForNative(meal), dashboard });
  } catch (error) {
    logWriteFailure('meal.route', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 400 });
    }

    if (error instanceof DuplicateMealSaveError) {
      return NextResponse.json({
        error: 'That meal was already saved.',
        duplicate: true,
        mealId: error.existingMealId,
      }, { status: 409 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
  }
}
