import { NextResponse } from 'next/server';
import { z } from 'zod';

import { parsedFoodItemSchema } from '@/lib/ai/types';
import { getCustomFoods } from '@/lib/custom-foods';
import { revalidateFoodIntelligenceItems } from '@/lib/food-intelligence/engine';
import { logWriteFailure } from '@/lib/persistence';
import { getReusableMealLibrary } from '@/lib/reusable-meals';

const requestSchema = z.object({
  origin: z.enum(['favorite', 'history', 'suggestion']),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(parsedFoodItemSchema).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'That saved meal could not be prepared for review.' }, { status: 400 });
    }
    const [customFoods, reusableMeals] = await Promise.all([
      getCustomFoods(),
      getReusableMealLibrary(),
    ]);
    return NextResponse.json(await revalidateFoodIntelligenceItems({
      ...parsed.data,
      customFoods,
      favoriteMeals: reusableMeals.favoriteMeals,
      recentMeals: reusableMeals.recentMeals,
    }));
  } catch (error) {
    logWriteFailure('food-intelligence.revalidate.post', error);
    return NextResponse.json({ error: 'That meal could not be refreshed right now. The original is still available.' }, { status: 500 });
  }
}
