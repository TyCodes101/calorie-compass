import { NextResponse } from 'next/server';

import { buildBarcodeLookupResult, markSearchResultAsBarcodeMatch, normalizeBarcode } from '@/lib/barcode-lookup';
import { getCustomFoods } from '@/lib/custom-foods';
import { verifiedCatalogFoodsForLookup } from '@/lib/food-search';
import { logWriteFailure } from '@/lib/persistence';
import { cachedFoodToSearchResult, getCachedFoodByBarcode } from '@/lib/nutrition/source-cache';
import { resolveBarcodeNutrition } from '@/lib/nutrition/barcodeResolver';

export async function GET(request: Request) {
  const rawBarcode = new URL(request.url).searchParams.get('barcode') ?? '';
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return NextResponse.json({ found: false, result: null, error: 'Enter 8 to 14 barcode digits.' }, { status: 400 });
  }

  try {
    const localResult = buildBarcodeLookupResult({
      barcode,
      customFoods: await getCustomFoods(),
      catalogFoods: verifiedCatalogFoodsForLookup(),
    });
    if (localResult.found) {
      return NextResponse.json({ barcode, ...localResult });
    }

    const cached = await getCachedFoodByBarcode(barcode);
    if (cached) {
      return NextResponse.json({ barcode, found: true, result: markSearchResultAsBarcodeMatch(cachedFoodToSearchResult(cached), barcode) });
    }

    const providerResult = await resolveBarcodeNutrition(barcode);
    if (providerResult.found) {
      return NextResponse.json({ barcode, ...providerResult });
    }

    return NextResponse.json({ barcode, found: false, result: null });
  } catch (error) {
    logWriteFailure('barcode-lookup.route.get', error);
    return NextResponse.json({ barcode, found: false, result: null });
  }
}
