import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parseMealText } from '@/lib/ai/openai';

const requestSchema = z.object({
  text: z.string().min(3),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  barcode: z.string().min(8).max(14).optional(),
  nutritionLabel: z
    .object({
      name: z.string().nullable().optional(),
      servingQuantity: z.number().nonnegative().nullable().optional(),
      servingUnit: z.string().nullable().optional(),
      calories: z.number().nonnegative(),
      protein: z.number().nonnegative().nullable().optional(),
      carbs: z.number().nonnegative().nullable().optional(),
      fat: z.number().nonnegative().nullable().optional(),
      fiber: z.number().nonnegative().nullable().optional(),
      sugar: z.number().nonnegative().nullable().optional(),
      sodium: z.number().nonnegative().nullable().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, mealType, barcode, nutritionLabel } = requestSchema.parse(body);
    const parsed = await parseMealText(text, mealType, { barcode, nutritionLabel });
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('parse-meal error', error);
    return NextResponse.json(
      {
        error: 'We could not estimate that meal right now. Please try again.',
      },
      { status: 500 }
    );
  }
}
