import { NextResponse } from 'next/server';

import { buildBarcodeLookupResult, normalizeBarcode } from '@/lib/barcode-lookup';
import { getCustomFoods } from '@/lib/custom-foods';
import { verifiedCatalogFoodsForLookup } from '@/lib/food-search';
import { logWriteFailure } from '@/lib/persistence';

export async function GET(request: Request) {
  const rawBarcode = new URL(request.url).searchParams.get('barcode') ?? '';
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return NextResponse.json({ found: false, result: null, error: 'Enter 8 to 14 barcode digits.' }, { status: 400 });
  }

  try {
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
