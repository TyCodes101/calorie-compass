import { NextResponse } from 'next/server';

import { getCustomFoods } from '@/lib/custom-foods';
import { searchFoodIntelligence } from '@/lib/food-intelligence/engine';
import { createFoodSearchDiagnostics } from '@/lib/food-search';
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
    const debugEnabled = process.env.NODE_ENV !== 'production' && process.env.FOOD_SEARCH_DEBUG === '1';
    const diagnostics = debugEnabled ? createFoodSearchDiagnostics(query) : undefined;
    const [customFoods, reusableMeals] = await Promise.all([
      getCustomFoods(),
      getReusableMealLibrary(),
    ]);

    const response = await searchFoodIntelligence({
      query,
      origin: 'search',
      customFoods,
      favoriteMeals: reusableMeals.favoriteMeals,
      recentMeals: reusableMeals.recentMeals,
    }, diagnostics ? { search: { diagnostics } } : undefined);
    return NextResponse.json(diagnostics ? { ...response, pipeline_debug: diagnostics } : response);
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
