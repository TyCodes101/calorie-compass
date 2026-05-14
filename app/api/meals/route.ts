import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDashboardData } from '@/lib/dashboard';
import { saveConfirmedMeal } from '@/lib/meals';
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
  confidence_label: z.enum(['Verified', 'High confidence', 'Estimated']).nullable().optional(),
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
  items: z.array(parsedItemSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const meal = await saveConfirmedMeal(payload);
    const dashboard = await getDashboardData(payload.date ?? new Date());

    return NextResponse.json({ meal, dashboard });
  } catch (error) {
    logWriteFailure('meal.route', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
    }

    return NextResponse.json({ error: getPersistenceErrorMessage('meal') }, { status: 500 });
  }
}
