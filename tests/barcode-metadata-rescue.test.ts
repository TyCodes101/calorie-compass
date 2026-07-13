import { describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { resolveBarcodeNutrition } from '@/lib/nutrition/barcodeResolver';

function providerResponse(overrides: Record<string, unknown> = {}) {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: 0.84,
    items: [{
      food_name: 'Example Foods Creamy Crisp Protein Bar',
      quantity: 1,
      unit: 'bar',
      calories: 200,
      protein: 20,
      carbs: 18,
      fat: 7,
      fiber: 3,
      sugar: 2,
      sodium: 180,
      source_type: 'GENERIC_REFERENCE',
      source_name: 'USDA FoodData Central',
      provider_used: 'usda-fdc',
      is_trusted: true,
      confidence_label: 'Matched',
      used_ai_fallback: false,
      ...overrides,
    }],
  });
}

const metadata = {
  barcode: '012345678905',
  title: 'Creamy Crisp Protein Bar',
  brand: 'Example Foods',
  manufacturer: null,
  category: 'Food > Snack Bars',
  packageDescription: '1 bar 55 g',
};

describe('barcode metadata rescue', () => {
  it('uses direct nutrition first and never calls metadata rescue on a hit', async () => {
    const metadataLookup = vi.fn();
    const directResult = { found: true, result: { id: 'direct' } } as never;
    const result = await resolveBarcodeNutrition(metadata.barcode, 'snack', {
      directLookup: vi.fn().mockResolvedValue(directResult),
      metadataLookup,
    });
    expect(result).toBe(directResult);
    expect(metadataLookup).not.toHaveBeenCalled();
  });

  it('allows one bounded secondary nutrition search while preserving nutrition provenance', async () => {
    const secondaryLookup = vi.fn().mockResolvedValue(providerResponse());
    const result = await resolveBarcodeNutrition(metadata.barcode, 'snack', {
      directLookup: vi.fn().mockResolvedValue({ found: false, result: null }),
      metadataLookup: vi.fn().mockResolvedValue(metadata),
      secondaryLookup,
    });

    expect(secondaryLookup).toHaveBeenCalledOnce();
    expect(secondaryLookup).toHaveBeenCalledWith('Example Foods Creamy Crisp Protein Bar 1 bar 55 g', 'snack');
    expect(result).toMatchObject({
      found: true,
      result: { providerId: 'usda-fdc', sourceName: 'USDA FoodData Central', barcode: '012345678905' },
    });
    expect(result.result?.items[0]?.notes).toMatch(/identity was recovered/i);
  });

  it.each([
    ['wrong product identity', providerResponse({ food_name: 'Another Brand Chocolate Cookies' })],
    ['AI nutrition estimate', providerResponse({ source_type: 'AI_ESTIMATE', used_ai_fallback: true, is_trusted: false })],
    ['clarification result', normalizeParsedMealResponse({ needs_clarification: true, clarifying_question: 'Which one?', meal_type: 'snack', confidence_score: 0.3, items: [] })],
  ])('rejects %s during metadata rescue', async (_name, response) => {
    const result = await resolveBarcodeNutrition(metadata.barcode, 'snack', {
      directLookup: vi.fn().mockResolvedValue({ found: false, result: null }),
      metadataLookup: vi.fn().mockResolvedValue(metadata),
      secondaryLookup: vi.fn().mockResolvedValue(response),
    });
    expect(result).toEqual({ found: false, result: null });
  });

  it('does not treat non-food metadata as a nutrition identity', async () => {
    const secondaryLookup = vi.fn().mockResolvedValue(providerResponse());
    const result = await resolveBarcodeNutrition(metadata.barcode, 'snack', {
      directLookup: vi.fn().mockResolvedValue({ found: false, result: null }),
      metadataLookup: vi.fn().mockResolvedValue({ ...metadata, category: 'Electronics > Chargers' }),
      secondaryLookup,
    });
    expect(result).toEqual({ found: false, result: null });
    expect(secondaryLookup).not.toHaveBeenCalled();
  });
});
