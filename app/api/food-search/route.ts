import { NextResponse } from 'next/server';

import { getCustomFoods } from '@/lib/custom-foods';
import { buildFoodSearchResponse } from '@/lib/food-search';
import { logWriteFailure } from '@/lib/persistence';
import { getReusableMealLibrary } from '@/lib/reusable-meals';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({
      query,
      normalizedQuery: query,
      results: [],
      clarificationQuestion: null,
      usedResolver: false,
      usedRanking: false,
      cache: {
        resolverHit: false,
        rankingHit: false,
        selectedResultHit: false,
      },
    });
  }

  try {
    const [customFoods, reusableMeals] = await Promise.all([
      getCustomFoods(),
      getReusableMealLibrary(),
    ]);

    return NextResponse.json(await buildFoodSearchResponse({
      query,
      customFoods,
      favoriteMeals: reusableMeals.favoriteMeals,
      recentMeals: reusableMeals.recentMeals,
    }));
  } catch (error) {
    logWriteFailure('food-search.route.get', error);
    return NextResponse.json({
      query,
      normalizedQuery: query,
      results: [],
      clarificationQuestion: null,
      usedResolver: false,
      usedRanking: false,
      cache: {
        resolverHit: false,
        rankingHit: false,
        selectedResultHit: false,
      },
    });
  }
}
