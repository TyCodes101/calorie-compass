import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parseMealText } from '@/lib/ai/openai';

const requestSchema = z.object({
  text: z.string().min(3),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, mealType } = requestSchema.parse(body);
    const parsed = await parseMealText(text, mealType);
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
