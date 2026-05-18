import { describe, expect, it } from 'vitest';

import { formatHistoryCounts, formatMealSourceSummary } from '@/components/history-client';

describe('history client copy helpers', () => {
  it('formats history counts without awkward plurals', () => {
    expect(formatHistoryCounts(0, 0)).toBe('0 favorites, 0 logged meals');
    expect(formatHistoryCounts(1, 1)).toBe('1 favorite, 1 logged meal');
    expect(formatHistoryCounts(2, 3)).toBe('2 favorites, 3 logged meals');
  });

  it('describes structured source coverage clearly', () => {
    expect(formatMealSourceSummary(1, 0)).toBe('1 structured match, 0 estimates');
    expect(formatMealSourceSummary(2, 1)).toBe('2 structured matches, 1 estimate');
  });
});
