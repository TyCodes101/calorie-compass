import { NextResponse } from 'next/server';

import { getCustomFoods } from '@/lib/custom-foods';
import { revalidateFoodIntelligenceItems } from '@/lib/food-intelligence/engine';
import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { repeatReusableMeal } from '@/lib/reusable-meals';

export async function POST(_request: Request, context: { params: Promise<{ reusableMealId: string }> }) {
  const { reusableMealId } = await context.params;

  try {
    const reusableMeal = await repeatReusableMeal(reusableMealId);
    const review = await revalidateFoodIntelligenceItems({
      origin: 'favorite',
      mealType: reusableMeal.mealType,
      items: reusableMeal.items ?? [],
      customFoods: await getCustomFoods(),
      favoriteMeals: [reusableMeal],
      recentMeals: [],
    });

    return NextResponse.json({ review, saved: false });
  } catch (error) {
    logWriteFailure('favorite.route.repeat', error, { reusableMealId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't repeat that meal right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't repeat that meal right now. Please try again." }, { status: 500 });
  }
}
