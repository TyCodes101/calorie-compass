import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createCustomFood, getCustomFoods } from '@/lib/custom-foods';
import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';

const customFoodSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brand: z.string().trim().max(80).nullable().optional(),
  servingQuantity: z.number().positive().max(10_000),
  servingUnit: z.string().trim().min(1).max(32),
  calories: z.number().nonnegative().max(10_000),
  protein: z.number().nonnegative().max(1_000),
  carbs: z.number().nonnegative().max(1_000),
  fat: z.number().nonnegative().max(1_000),
  fiber: z.number().nonnegative().max(1_000).nullable().optional(),
  sugar: z.number().nonnegative().max(1_000).nullable().optional(),
  sodium: z.number().nonnegative().max(100_000).nullable().optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ customFoods: await getCustomFoods() });
  } catch (error) {
    logWriteFailure('custom-food.route.get', error);
    return NextResponse.json({ customFoods: [] });
  }
}

export async function POST(request: Request) {
  try {
    const payload = customFoodSchema.parse(await request.json());
    const customFood = await createCustomFood(payload);
    return NextResponse.json({ customFood });
  } catch (error) {
    logWriteFailure('custom-food.route.post', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Enter a valid custom food before saving.' }, { status: 400 });
    }

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't save that custom food right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't save that custom food right now. Please try again." }, { status: 500 });
  }
}
