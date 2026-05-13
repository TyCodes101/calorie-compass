import { describe, expect, it } from 'vitest';

import { getMockParsedMeal } from '@/lib/ai/mock';

describe('confidence reflects trusted nutrition coverage', () => {
  it('scores fully trusted meals higher than mixed-source meals', () => {
    const fullyTrusted = getMockParsedMeal('3 scrambled eggs and 2 slices of toast', 'breakfast');
    const mixedSource = getMockParsedMeal('3 eggs and hash browns', 'breakfast');

    expect(fullyTrusted.confidence_score).toBeGreaterThan(mixedSource.confidence_score);
    expect(fullyTrusted.items.every((item) => item.is_trusted)).toBe(true);
    expect(mixedSource.items.some((item) => item.source_type === 'AI_ESTIMATE')).toBe(true);
  });
});
