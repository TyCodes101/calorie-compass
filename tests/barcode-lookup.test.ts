import { describe, expect, it } from 'vitest';

import { buildBarcodeLookupResult, normalizeBarcode } from '@/lib/barcode-lookup';
import { buildCustomFoodSummaryFromReusableMealRecord } from '@/lib/custom-foods';

describe('barcode lookup helpers', () => {
  it('normalizes valid UPC and EAN inputs', () => {
    expect(normalizeBarcode(' 01234-5678905 ')).toBe('012345678905');
    expect(normalizeBarcode('abc')).toBeNull();
    expect(normalizeBarcode('123')).toBeNull();
  });

  it('finds verified catalog barcode data when present', () => {
    const result = buildBarcodeLookupResult({
      barcode: '111111111111',
      customFoods: [],
      catalogFoods: [{
        id: 'catalog-protein',
        sourceId: 'generic_reference',
        canonicalName: 'Verified Protein Bar',
        brand: 'MacroMesh Test',
        servingQuantity: 1,
        servingUnit: 'bar',
        calories: 220,
        protein: 20,
        carbs: 22,
        fat: 7,
        fiber: 5,
        sugar: 2,
        sodium: 190,
        active: true,
        aliases: ['verified protein bar'],
        barcode: '111111111111',
      }],
    });

    expect(result.found).toBe(true);
    expect(result.result).toMatchObject({
      name: 'Verified Protein Bar',
      sourceLabel: 'Verified',
      barcode: '111111111111',
    });
  });

  it('finds custom food barcodes after catalog lookup', () => {
    const customFood = buildCustomFoodSummaryFromReusableMealRecord({
      id: 'custom-1',
      title: 'Turkey Chili',
      rawText: 'Custom food: Turkey Chili',
      items: [{
        foodName: 'Turkey Chili',
        quantity: 1,
        unit: 'bowl',
        calories: 410,
        protein: 36,
        carbs: 32,
        fat: 14,
        fiber: 8,
        sugar: 6,
        sodium: 720,
        notes: 'Custom food barcode: 012345678905',
        sourceName: 'Custom food: Home',
      }],
    });

    const result = buildBarcodeLookupResult({ barcode: '012345678905', customFoods: [customFood], catalogFoods: [] });

    expect(result.found).toBe(true);
    expect(result.result).toMatchObject({
      id: 'custom-1',
      sourceLabel: 'Custom',
      name: 'Turkey Chili',
    });
  });

  it('returns not found instead of inventing product data', () => {
    const result = buildBarcodeLookupResult({ barcode: '999999999999', customFoods: [], catalogFoods: [] });

    expect(result).toEqual({ found: false, result: null });
  });
});
