import { describe, expect, it } from 'vitest';

import type { ParsedFoodItem } from '@/lib/ai/types';
import {
  assessNutritionRisk,
  buildNutritionFailureSignal,
  buildNutritionSourceSnapshot,
  configureNutritionFailureSignalSink,
  detectNutritionSourceDrift,
  recordNutritionFailureSignal,
} from '@/lib/nutrition/reliability';

function item(overrides: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'Quest BBQ Protein Chips',
    quantity: 1,
    unit: 'bag',
    calories: 140,
    protein: 19,
    carbs: 5,
    fat: 5,
    fiber: 1,
    sugar: 1,
    sodium: 350,
    notes: 'Matched to trusted catalog entry from Quest nutrition reference.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Quest nutrition reference',
    confidence_label: 'Verified',
    match_type: 'exact_branded',
    matched_query: 'Quest BBQ Protein Chips',
    original_user_text: 'Quest BBQ Protein Chips',
    provider_used: 'local-verified-catalog',
    used_ai_fallback: false,
    catalog_food_id: 'quest_bbq_protein_chips',
    ...overrides,
  };
}

describe('nutrition reliability framework', () => {
  it('scores exact verified catalog matches as low internal risk', () => {
    const assessment = assessNutritionRisk(item({}), {
      expectedBrand: 'Quest',
      expectedCategory: 'protein_snack',
      candidateCount: 1,
    });

    expect(assessment.riskLevel).toBe('LOW');
    expect(assessment.riskScore).toBeLessThan(25);
    expect(assessment.shouldClarify).toBe(false);
    expect(assessment.issues).toEqual([]);
  });

  it('flags invalid serving, macro mismatch, and protected-brand mismatch as high risk', () => {
    const assessment = assessNutritionRisk(
      item({
        food_name: 'Whole milk',
        quantity: 0,
        unit: '',
        calories: 100,
        protein: 4,
        carbs: 30,
        fat: 30,
        source_name: 'Generic nutrition reference',
        confidence_label: 'Matched',
        match_type: 'verified_database',
      }),
      {
        expectedBrand: 'Fairlife',
        expectedCategory: 'protein_drink',
        candidateCount: 3,
      },
    );

    expect(assessment.riskLevel).toBe('HIGH');
    expect(assessment.shouldClarify).toBe(true);
    expect(assessment.issues).toEqual(expect.arrayContaining([
      'missing_serving',
      'macro_calorie_mismatch',
      'brand_mismatch',
      'protein_product_low_protein',
      'multiple_candidates',
    ]));
  });

  it('detects unexpected source drift from stable fingerprints', () => {
    const previous = buildNutritionSourceSnapshot(item({
      food_name: 'Coke Zero',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugar: 0,
      sodium: 40,
      source_name: 'Coke Zero nutrition reference',
      sourceId: 'coke-zero-reference',
    }), '2026-06-01T00:00:00.000Z');
    const current = buildNutritionSourceSnapshot(item({
      food_name: 'Coke Zero',
      calories: 140,
      protein: 0,
      carbs: 39,
      fat: 0,
      sugar: 39,
      sodium: 45,
      source_name: 'Coke Zero nutrition reference',
      sourceId: 'coke-zero-reference',
    }), '2026-06-09T00:00:00.000Z');

    const drift = detectNutritionSourceDrift(previous, current);

    expect(drift.hasDrift).toBe(true);
    expect(drift.requiresReview).toBe(true);
    expect(drift.changedFields).toEqual(expect.arrayContaining(['calories', 'carbs', 'sugar']));
  });

  it('captures correction signals without storing raw user text', () => {
    const signal = buildNutritionFailureSignal({
      kind: 'food_replaced',
      text: 'I had Quest BBQ Protein Chips but you logged regular chips',
      reason: 'brand_mismatch',
      previousItem: item({ food_name: 'Potato chips', source_name: 'Generic nutrition reference' }),
      nextItem: item({ food_name: 'Quest BBQ Protein Chips' }),
    });

    expect(signal.kind).toBe('food_replaced');
    expect(signal.queryHash).toMatch(/^[a-f0-9]{8}$/);
    expect(signal.reason).toBe('brand_mismatch');
    expect(JSON.stringify(signal)).not.toContain('Quest BBQ Protein Chips but you logged regular chips');
    expect(signal.previousItemFingerprint).not.toBe(signal.nextItemFingerprint);
  });

  it('records anonymized failure signals through a configurable sink', () => {
    const captured: unknown[] = [];
    configureNutritionFailureSignalSink((signal) => captured.push(signal));

    const signal = recordNutritionFailureSignal({
      kind: 'review_abandoned',
      text: 'I searched chips three times and left the review',
      reason: 'review_abandoned_after_repeated_search',
      candidateCount: 3,
    });

    configureNutritionFailureSignalSink(null);

    expect(captured).toEqual([signal]);
    expect(signal.candidateCount).toBe(3);
    expect(JSON.stringify(signal)).not.toContain('I searched chips three times');
  });
});
