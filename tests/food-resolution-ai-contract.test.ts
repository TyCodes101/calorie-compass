import { describe, expect, it } from 'vitest';

import {
  aiFoodResolutionAssistSchema,
  resolveAiFoodResolutionAssist,
  type AiFoodResolutionAssist,
} from '@/lib/nutrition/aiFoodResolution';
import {
  parsedFoodItemToFoodCandidate,
  type FoodCandidate,
} from '@/lib/nutrition/foodResolution';
import { inferProductFamilyId } from '@/lib/nutrition/productFamilies';

function candidate(overrides: Partial<FoodCandidate> = {}): FoodCandidate {
  const canonicalName = overrides.canonicalName ?? overrides.displayName ?? 'Food';
  return {
    candidateId: overrides.candidateId ?? canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    provider: overrides.provider ?? 'test-provider',
    source: overrides.source ?? 'catalog',
    sourceTrust: overrides.sourceTrust ?? 'official_restaurant',
    restaurant: overrides.restaurant ?? null,
    brand: overrides.brand ?? null,
    productFamilyId: overrides.productFamilyId ?? inferProductFamilyId(canonicalName),
    canonicalName,
    displayName: overrides.displayName ?? canonicalName,
    sourceName: overrides.sourceName ?? 'Test source',
    serving: overrides.serving ?? { quantity: 1, unit: 'item' },
    calories: overrides.calories ?? 100,
    protein: overrides.protein ?? 10,
    carbs: overrides.carbs ?? 10,
    fat: overrides.fat ?? 2,
    modifiersSupported: overrides.modifiersSupported ?? true,
    verified: overrides.verified ?? true,
    estimated: overrides.estimated ?? false,
    lastReviewedAt: overrides.lastReviewedAt ?? null,
    catalogVersion: overrides.catalogVersion ?? null,
    rawSource: overrides.rawSource ?? null,
  };
}

function assist(overrides: Partial<AiFoodResolutionAssist> = {}): AiFoodResolutionAssist {
  return aiFoodResolutionAssistSchema.parse({
    intent: {
      rawText: 'I had a wendys baconator',
      searchText: "Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      modifiers: [],
      mealType: 'lunch',
    },
    normalizedQuery: "Wendy's Baconator",
    restaurant: "Wendy's",
    brand: "Wendy's",
    productName: 'Baconator',
    productFamilyGuess: 'wendys_baconator',
    modifiers: [],
    quantity: 1,
    serving: 'sandwich',
    candidateRankings: [],
    clarificationQuestion: null,
    estimateRequest: null,
    ...overrides,
  });
}

describe('AI food resolution contract', () => {
  it('parses the guarded AI assist schema', () => {
    const parsed = assist({
      candidateRankings: [{
        candidateId: 'catalog:wendys_baconator',
        reason: 'Restaurant and product family match.',
        confidence: 0.94,
      }],
    });

    expect(parsed.normalizedQuery).toBe("Wendy's Baconator");
    expect(parsed.candidateRankings[0]).toMatchObject({
      candidateId: 'catalog:wendys_baconator',
      confidence: 0.94,
    });
  });

  it('rejects malformed AI candidate rankings', () => {
    expect(() => aiFoodResolutionAssistSchema.parse({
      intent: { rawText: 'mcdouble', searchText: 'mcdouble', modifiers: [] },
      normalizedQuery: '',
      candidateRankings: [{ candidateId: '', reason: '', confidence: 1.2 }],
    })).toThrow();
  });

  it('rejects AI output that selects a candidate ID outside the backend set', () => {
    const baconator = candidate({
      candidateId: 'catalog:wendys_baconator',
      canonicalName: "Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_baconator',
    });

    const result = resolveAiFoodResolutionAssist({
      assist: assist({
        candidateRankings: [{
          candidateId: 'model-invented-baconator',
          reason: 'The model invented this ID.',
          confidence: 0.99,
        }],
      }),
      candidates: [baconator],
    });

    expect(result.status).toBe('needs_clarification');
    expect(result.selectedCandidate).toBeNull();
    expect(result.aiUsed).toBe(true);
    expect(result.aiRole).toBe('reranker');
    expect(result.rejectionReasons).toEqual(expect.arrayContaining([
      'ai_candidate_not_in_candidate_set',
      'selected_candidate_not_in_candidate_set',
    ]));
  });

  it('lets the identity firewall beat high-confidence AI reranking', () => {
    const chicken = candidate({
      candidateId: 'catalog:wendys_spicy_chicken',
      canonicalName: "Wendy's Spicy Chicken Sandwich",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_spicy_chicken',
    });
    const baconator = candidate({
      candidateId: 'catalog:wendys_baconator',
      canonicalName: "Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_baconator',
    });

    const result = resolveAiFoodResolutionAssist({
      assist: assist({
        candidateRankings: [{
          candidateId: chicken.candidateId,
          reason: 'AI tried to choose chicken.',
          confidence: 0.99,
        }],
      }),
      candidates: [chicken, baconator],
    });

    expect(result.status).toBe('needs_clarification');
    expect(result.selectedCandidate).toBeNull();
    expect(result.rejectionReasons).toEqual(expect.arrayContaining([
      'product_family_conflict',
      'missing_protected_product_token:baconator',
    ]));
  });

  it('returns complete AI resolution metadata for a source-backed candidate', () => {
    const baconator = candidate({
      candidateId: 'catalog:wendys_baconator',
      canonicalName: "Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_baconator',
      lastReviewedAt: '2026-06-17',
      catalogVersion: '2026-06-17',
    });

    const result = resolveAiFoodResolutionAssist({
      assist: assist({
        normalizedQuery: "Wendy's Baconator sandwich",
        candidateRankings: [{
          candidateId: baconator.candidateId,
          reason: 'Source-backed restaurant candidate matches.',
          confidence: 0.93,
        }],
      }),
      candidates: [baconator],
    });

    expect(result).toMatchObject({
      status: 'resolved',
      normalizedQuery: "Wendy's Baconator sandwich",
      aiUsed: true,
      aiRole: 'reranker',
      sourceTrust: 'official_restaurant',
    });
    expect(result.selectedCandidate).toMatchObject({
      candidateId: baconator.candidateId,
      lastReviewedAt: '2026-06-17',
      catalogVersion: '2026-06-17',
    });
    expect(result.debugTrace).toMatchObject({
      aiUsed: true,
      aiRole: 'reranker',
      aiResultAccepted: true,
    });
  });

  it('does not allow AI estimates to masquerade as verified restaurant food', () => {
    const estimatedBaconator = candidate({
      candidateId: 'ai:wendys_baconator',
      provider: 'ai-estimate-provider',
      source: 'AI_ESTIMATE',
      sourceTrust: 'ai_estimate',
      canonicalName: "Estimated Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_baconator',
      verified: false,
      estimated: true,
    });

    const result = resolveAiFoodResolutionAssist({
      assist: assist({
        estimateRequest: {
          reason: 'No verified source was available.',
          label: 'AI Estimated',
        },
        candidateRankings: [{
          candidateId: estimatedBaconator.candidateId,
          reason: 'AI estimate only.',
          confidence: 0.7,
        }],
      }),
      candidates: [estimatedBaconator],
    });

    expect(result.status).toBe('needs_clarification');
    expect(result.selectedCandidate).toBeNull();
    expect(result.rejectionReasons).toEqual(expect.arrayContaining([
      'unverified_branded_or_restaurant_estimate',
      'low_confidence',
    ]));
  });

  it('preserves catalog review metadata when parsed items become candidates', () => {
    const result = parsedFoodItemToFoodCandidate({
      food_name: "Wendy's Baconator",
      quantity: 1,
      unit: 'sandwich',
      calories: 960,
      protein: 57,
      carbs: 38,
      fat: 66,
      fiber: 2,
      sugar: 8,
      sodium: 1540,
      is_trusted: true,
      source_type: 'OFFICIAL_RESTAURANT',
      source_name: "Wendy's official nutrition",
      confidence_label: 'Verified',
      catalog_food_id: 'wendys_baconator',
      lastReviewedAt: '2026-06-17',
      catalogVersion: '2026-06-17',
    }, 'local-verified-catalog');

    expect(result).toMatchObject({
      candidateId: 'catalog:wendys_baconator',
      productFamilyId: 'wendys_baconator',
      lastReviewedAt: '2026-06-17',
      catalogVersion: '2026-06-17',
    });
  });
});
