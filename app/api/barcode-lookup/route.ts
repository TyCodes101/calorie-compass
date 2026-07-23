import { NextResponse } from 'next/server';

import { normalizeBarcode } from '@/lib/barcode-lookup';
import { getCustomFoods } from '@/lib/custom-foods';
import { lookupBarcodeFoodIntelligence } from '@/lib/food-intelligence/engine';
import { logWriteFailure } from '@/lib/persistence';

export async function GET(request: Request) {
  const rawBarcode = new URL(request.url).searchParams.get('barcode') ?? '';
  const barcode = normalizeBarcode(rawBarcode);

  if (!barcode) {
    return NextResponse.json({ found: false, result: null, error: 'Enter 8 to 14 barcode digits.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await lookupBarcodeFoodIntelligence(barcode, {
      customFoods: await getCustomFoods(),
    }));
  } catch (error) {
    logWriteFailure('barcode-lookup.route.get', error);
    return NextResponse.json({ barcode, found: false, result: null });
  }
}
