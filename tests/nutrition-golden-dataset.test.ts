import { describe, expect, it, vi } from 'vitest';

import { runGoldenNutritionValidation } from '@/lib/nutrition/goldenDataset';

describe('golden nutrition dataset', () => {
  it('keeps protected foods stable', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    vi.stubEnv('NUTRITIONIX_APP_ID', '');
    vi.stubEnv('NUTRITIONIX_API_KEY', '');

    const result = await runGoldenNutritionValidation();

    expect(result.total).toBeGreaterThanOrEqual(10);
    expect(result.results.filter((row) => !row.passed)).toEqual([]);
    expect(result.failed).toBe(0);
    expect(result.passRate).toBe(1);
    expect(result.results.map((row) => row.id)).toEqual(expect.arrayContaining([
      'quest-bbq-protein-chips',
      'mcdouble',
      'coke-zero',
      'skittles-pack',
      'fairlife-core-power-elite',
      'chipotle-chicken-bowl',
      'large-baked-potato',
      'eggs-and-toast',
      'eight-oz-chicken-breast',
      'generic-chips-clarification',
      'protein-shake-clarification',
    ]));
  }, 60_000);
});
