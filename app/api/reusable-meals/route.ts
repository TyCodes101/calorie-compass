import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getPersistenceErrorMessage, isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { buildReusableMealSummaryFromRecord, createFavoriteMealTemplate, getReusableMealLibrary } from '@/lib/reusable-meals';
import { normalizeNutritionVerificationLabel, nutritionVerificationLabels } from '@/lib/nutrition/verification';

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
  reusable_meal_id: z.string().nullable().optional(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence_score: z.number().min(0).max(1),
  raw_text: z.string().nullable().optional(),
  items: z.array(parsedItemSchema).min(1),
});

export async function GET() {
  try {
    return NextResponse.json(await getReusableMealLibrary());
  } catch (error) {
    logWriteFailure('favorite.route.get', error);
    return NextResponse.json({ favoriteMeals: [], recentMeals: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const favoriteMeal = buildReusableMealSummaryFromRecord(await createFavoriteMealTemplate(payload));

    return NextResponse.json({ favoriteMeal });
  } catch (error) {
    logWriteFailure('favorite.route', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('favorite') }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('favorite') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('favorite') }, { status: 500 });
  }
}
