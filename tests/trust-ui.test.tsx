import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TrustBadge } from '@/components/trust-badge';
import { getItemSourceLabel, summarizeParsedItems } from '@/lib/trust';

describe('trust ui helpers', () => {
  it('returns human-friendly source labels', () => {
    expect(getItemSourceLabel({
      food_name: 'Chipotle chicken',
      quantity: 1,
      unit: 'serving',
      calories: 180,
      protein: 32,
      carbs: 1,
      fat: 7,
      fiber: 0,
      sugar: 0,
      sodium: 310,
      is_trusted: true,
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: 'Chipotle official nutrition',
      catalog_food_id: 'chipotle_chicken',
    })).toBe('Chipotle official nutrition');

    expect(getItemSourceLabel({
      food_name: 'Hash browns',
      quantity: 1,
      unit: 'serving',
      calories: 180,
      protein: 2,
      carbs: 24,
      fat: 8,
      fiber: 2,
      sugar: 0,
      sodium: 320,
      is_trusted: false,
      source_type: 'AI_ESTIMATE',
      source_name: 'Fallback estimate',
      catalog_food_id: null,
    })).toBe('Estimated nutrition');
  });

  it('summarizes verified versus estimated coverage in calm language', () => {
    const summary = summarizeParsedItems([
      {
        food_name: 'Large egg',
        quantity: 3,
        unit: 'egg',
        calories: 210,
        protein: 18,
        carbs: 1.8,
        fat: 15,
        fiber: 0,
        sugar: 0.6,
        sodium: 210,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Generic nutrition reference',
        catalog_food_id: 'generic_large_egg',
      },
      {
        food_name: 'Toast',
        quantity: 2,
        unit: 'slice',
        calories: 180,
        protein: 6,
        carbs: 34,
        fat: 2,
        fiber: 2,
        sugar: 2,
        sodium: 320,
        is_trusted: true,
        source_type: 'GENERIC_REFERENCE',
        source_name: 'Generic nutrition reference',
        catalog_food_id: 'generic_bread',
      },
      {
        food_name: 'Hash browns',
        quantity: 1,
        unit: 'serving',
        calories: 180,
        protein: 2,
        carbs: 24,
        fat: 8,
        fiber: 2,
        sugar: 0,
        sodium: 320,
        is_trusted: false,
        source_type: 'AI_ESTIMATE',
        source_name: 'Fallback estimate',
        catalog_food_id: null,
      },
    ]);

    expect(summary.trustedCount).toBe(2);
    expect(summary.estimatedCount).toBe(1);
    expect(summary.coverageSummary).toBe('2 of 3 foods matched trusted sources');
    expect(summary.estimatedSummary).toBe('1 food estimated');
  });
});

describe('TrustBadge', () => {
  it('renders a verified badge for trusted foods', () => {
    render(<TrustBadge trusted />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders an estimated badge for estimated foods', () => {
    render(<TrustBadge trusted={false} />);
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });
});

