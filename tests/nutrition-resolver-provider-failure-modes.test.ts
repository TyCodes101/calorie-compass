import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookupNutrition: vi.fn(),
  resolveBarcodeNutrition: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
  getCurrentUserId: vi.fn(),
  prisma: { meal: { findMany: vi.fn() } },
}));

vi.mock('@/lib/nutrition/nutritionLookup', () => ({ lookupNutrition: mocks.lookupNutrition }));
vi.mock('@/lib/nutrition/barcodeResolver', () => ({ resolveBarcodeNutrition: mocks.resolveBarcodeNutrition }));
vi.mock('@/lib/current-user', () => ({
  hasDatabaseConnectionString: mocks.hasDatabaseConnectionString,
  getCurrentUserId: mocks.getCurrentUserId,
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';

describe('nutrition resolver provider failure modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookupNutrition.mockResolvedValue(null);
    mocks.resolveBarcodeNutrition.mockResolvedValue({ found: false, result: null });
    mocks.hasDatabaseConnectionString.mockReturnValue(false);
  });

  it('uses only normalized provider barcode data', async () => {
    mocks.resolveBarcodeNutrition.mockResolvedValue({
      found: true,
      result: {
        confidenceScore: 0.84,
        items: [{
          food_name: 'Community Protein Bar', quantity: 1, unit: 'bar', calories: 220,
          protein: 20, carbs: 22, fat: 7, fiber: 2, sugar: 2, sodium: 150,
          is_trusted: true, source_type: 'GENERIC_REFERENCE', source_name: 'Open Food Facts community database',
          confidence_label: 'Matched', provider_used: 'open-food-facts', used_ai_fallback: false,
        }],
      },
    });

    const result = await resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' });
    expect(result?.items[0]).toMatchObject({
      food_name: 'Community Protein Bar', calories: 220, provider_used: 'open-food-facts', confidence_label: 'Matched',
    });
    expect(mocks.lookupNutrition).not.toHaveBeenCalled();
  });

  it('falls back to normal resolution after a barcode miss', async () => {
    await resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' });
    expect(mocks.lookupNutrition).toHaveBeenCalledWith({
      text: '012345678905', mealType: 'snack', nutritionLabel: null, barcode: null,
    });
  });

  it('does not swallow an unexpected barcode orchestrator failure', async () => {
    mocks.resolveBarcodeNutrition.mockRejectedValue(new Error('orchestrator contract failure'));
    await expect(resolveNutritionEstimate({ text: '012345678905', mealType: 'snack' })).rejects.toThrow('orchestrator contract failure');
    expect(mocks.lookupNutrition).not.toHaveBeenCalled();
  });
});
