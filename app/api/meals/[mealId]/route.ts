import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDashboardData } from '@/lib/dashboard';
import { deleteSavedMeal, updateSavedMeal } from '@/lib/meals';
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
  confidence_label: z.enum(['Very High', 'High', 'Medium', 'Low', 'Verified', 'High confidence', 'Estimated']).nullable().optional(),
  match_type: z.enum(['exact_branded', 'exact_restaurant', 'fuzzy_branded', 'fuzzy_restaurant', 'verified_database', 'generic_estimate', 'ai_estimate', 'unknown']).nullable().optional(),
  matched_query: z.string().nullable().optional(),
  original_user_text: z.string().nullable().optional(),
  provider_used: z.string().nullable().optional(),
  used_ai_fallback: z.boolean().nullable().optional(),
  catalog_food_id: z.string().nullable().optional(),
});

const patchSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence_score: z.number().min(0).max(1),
  raw_text: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  date: z.string().optional(),
  source_reusable_meal_id: z.string().nullable().optional(),
  items: z.array(parsedItemSchema).min(1),
});

export async function PATCH(request: Request, context: { params: Promise<{ mealId: string }> }) {
  const { mealId } = await context.params;

  try {
    const body = await request.json();
    const payload = patchSchema.parse(body);
    const meal = await updateSavedMeal(mealId, payload);
    const dashboard = await getDashboardData(payload.date ?? meal.date);

    return NextResponse.json({ meal, dashboard });
  } catch (error) {
    logWriteFailure('meal.route.patch', error, { mealId });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ mealId: string }> }) {
  const { mealId } = await context.params;

  try {
    const deleted = await deleteSavedMeal(mealId);
    const dashboard = await getDashboardData(deleted.date);

    return NextResponse.json({ deleted, dashboard });
  } catch (error) {
    logWriteFailure('meal.route.delete', error, { mealId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: 'We couldn’t delete that meal right now. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ error: 'We couldn’t delete that meal right now. Please try again.' }, { status: 500 });
  }
}
