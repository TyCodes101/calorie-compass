import { describe, expect, it, vi } from 'vitest';

import { buildBarcodeLookupResult, lookupBarcodeWithProviders, normalizeBarcode } from '@/lib/barcode-lookup';
import { buildCustomFoodSummaryFromReusableMealRecord } from '@/lib/custom-foods';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

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
      sourceLabel: 'Brand verified',
      barcode: '111111111111',
      reason: 'Matched by barcode.',
    });
    expect(result.result?.items[0]?.match_type).toBe('exact_barcode');
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

  it('falls through a failed barcode provider and preserves the exact barcode on the next match', async () => {
    const failing: NutritionLookupProvider = {
      id: 'failing',
      capabilities: { search: false, barcode: true, details: false, suggest: false },
      lookup: vi.fn().mockResolvedValue(null),
      lookupBarcode: vi.fn().mockRejectedValue(new Error('provider down')),
    };
    const succeeding: NutritionLookupProvider = {
      id: 'succeeding',
      capabilities: { search: false, barcode: true, details: false, suggest: false },
      lookup: vi.fn().mockResolvedValue(null),
      lookupBarcode: vi.fn().mockResolvedValue(normalizeParsedMealResponse({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'snack',
        confidence_score: 0.9,
        items: [{
          food_name: 'Barcode Product', quantity: 1, unit: 'bar', calories: 200, protein: 20, carbs: 18, fat: 7,
          fiber: 2, sugar: 2, sodium: 150, is_trusted: true, source_type: 'GENERIC_REFERENCE',
          source_name: 'Provider barcode database', confidence_label: 'Matched', provider_used: 'succeeding',
        }],
      })),
    };

    const result = await lookupBarcodeWithProviders('012345678905', [failing, succeeding]);
    expect(result.result).toMatchObject({ barcode: '012345678905', providerId: 'succeeding', sourceLabel: 'Database match' });
    expect(result.result?.items[0]).toMatchObject({ match_type: 'exact_barcode', matched_query: '012345678905' });
    expect(succeeding.lookupBarcode).toHaveBeenCalledWith(expect.objectContaining({ barcode: '012345678905' }));
  });

  it('returns a normal miss when all configured barcode providers miss', async () => {
    const provider: NutritionLookupProvider = {
      id: 'missing',
      capabilities: { search: false, barcode: true, details: false, suggest: false },
      lookup: vi.fn().mockResolvedValue(null),
      lookupBarcode: vi.fn().mockResolvedValue(null),
    };
    expect(await lookupBarcodeWithProviders('999999999999', [provider])).toEqual({ found: false, result: null });
  });
});
