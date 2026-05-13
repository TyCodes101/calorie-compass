import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getDashboardData } from '@/lib/dashboard';
import { saveConfirmedMeal } from '@/lib/meals';

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
});

const requestSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence_score: z.number().min(0).max(1),
  raw_text: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  date: z.string().optional(),
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
    console.error('save meal error', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to save meal.',
      },
      { status: 400 }
    );
  }
}
