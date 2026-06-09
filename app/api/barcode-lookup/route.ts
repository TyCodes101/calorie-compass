import { NextResponse } from 'next/server';

import { buildBarcodeLookupResult, normalizeBarcode } from '@/lib/barcode-lookup';
import { getCustomFoods } from '@/lib/custom-foods';
import { verifiedCatalogFoodsForLookup } from '@/lib/food-search';
import { logWriteFailure } from '@/lib/persistence';
import { fetchOpenFoodFactsByBarcode } from '@/lib/nutrition/open-food-facts';
import { cachedFoodToSearchResult, getCachedFoodByBarcode, upsertCachedFoodFromOpenFoodFacts } from '@/lib/nutrition/source-cache';

export async function GET(request: Request) {
  const rawBarcode = new URL(request.url).searchParams.get('barcode') ?? '';
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return NextResponse.json({ found: false, result: null, error: 'Enter 8 to 14 barcode digits.' }, { status: 400 });
  }

  try {
    const cached = await getCachedFoodByBarcode(barcode);
    if (cached) {
      return NextResponse.json({ barcode, found: true, result: cachedFoodToSearchResult(cached) });
    }

    const off = await fetchOpenFoodFactsByBarcode(barcode);
    if (off.found) {
      const saved = await upsertCachedFoodFromOpenFoodFacts({
        providerId: off.providerId,
        barcode: off.barcode,
        name: off.name,
        brand: off.brand,
        calories: off.calories,
        protein: off.protein,
        carbs: off.carbs,
        fat: off.fat,
        fiber: off.fiber,
        sugar: off.sugar,
        sodium: off.sodium,
        rawPayload: off.raw,
      });

      return NextResponse.json({ barcode, found: true, result: cachedFoodToSearchResult(saved ?? {
        id: `off:${off.providerId}`,
        provider: 'OPEN_FOOD_FACTS',
        providerId: off.providerId,
        barcode: off.barcode,
        normalizedQuery: null,
        name: off.name,
        brand: off.brand,
        servingQuantity: 1,
        servingUnit: 'serving',
        calories: off.calories,
        protein: off.protein,
        carbs: off.carbs,
        fat: off.fat,
        fiber: off.fiber,
        sugar: off.sugar,
        sodium: off.sodium,
        rawPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) });
    }

    const result = buildBarcodeLookupResult({
      barcode,
      customFoods: await getCustomFoods(),
      catalogFoods: verifiedCatalogFoodsForLookup(),
    });

    return NextResponse.json({ barcode, ...result });
  } catch (error) {
    logWriteFailure('barcode-lookup.route.get', error);
    return NextResponse.json({ barcode, found: false, result: null });
  }
}
