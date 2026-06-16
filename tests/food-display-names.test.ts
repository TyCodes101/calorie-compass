import { describe, expect, it } from 'vitest';

import { buildFoodNameFields } from '@/lib/nutrition/displayNames';

describe('food display name normalization', () => {
  it('keeps raw source names separate from user-facing display names', () => {
    const fields = buildFoodNameFields({
      sourceFoodName: 'Corn, sweet, white, frozen, kernels on cob, unprepared',
      requestedText: 'buttered corn on the cob',
    });

    expect(fields).toEqual({
      source_food_name: 'Corn, sweet, white, frozen, kernels on cob, unprepared',
      canonical_name: 'Corn On The Cob',
      display_name: 'Buttered Corn on the Cob',
    });
  });

  it('singularizes common countable items while preserving preparation words', () => {
    expect(buildFoodNameFields({
      sourceFoodName: 'Chicken breast, grilled',
      requestedText: '2 grilled chicken breasts',
    })).toMatchObject({
      canonical_name: 'Grilled Chicken Breast',
      display_name: 'Grilled Chicken Breast',
    });
  });
});
