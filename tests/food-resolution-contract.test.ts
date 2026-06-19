import { afterEach, describe, expect, it, vi } from 'vitest';

import { findCatalogFoodById } from '@/lib/nutrition/catalog';
import {
  detectProductFamilies,
  getProductFamily,
  inferProductFamilyId,
} from '@/lib/nutrition/productFamilies';
import {
  resolveFoodCandidates,
  validateFoodIdentity,
  type FoodCandidate,
  type FoodResolutionIntent,
} from '@/lib/nutrition/foodResolution';

function intent(overrides: Partial<FoodResolutionIntent> = {}): FoodResolutionIntent {
  return {
    rawText: 'I had food',
    searchText: 'food',
    restaurant: null,
    brand: null,
    modifiers: [],
    mealType: 'lunch',
    ...overrides,
  };
}

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
    rawSource: overrides.rawSource ?? null,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('protected product families', () => {
  it('normalizes aliases and typos inside the same family only', () => {
    expect(detectProductFamilies('Wendys baconnator').map((family) => family.id)).toEqual(['wendys_baconator']);
    expect(detectProductFamilies('mc double no cheese').map((family) => family.id)).toEqual(['mcdonalds_mcdouble']);
    expect(detectProductFamilies('mc chicken').map((family) => family.id)).toEqual(['mcdonalds_mcchicken']);
  });

  it('declares incompatible families for protected restaurant products', () => {
    expect(getProductFamily('wendys_baconator')?.incompatibleFamilies).toEqual(
      expect.arrayContaining(['wendys_spicy_chicken', 'wendys_homestyle_chicken']),
    );
    expect(getProductFamily('mcdonalds_mcdouble')?.incompatibleFamilies).toEqual(
      expect.arrayContaining(['mcdonalds_mcchicken']),
    );
  });
});

describe('food identity firewall', () => {
  it('rejects Baconator queries resolved to Wendy chicken sandwiches', () => {
    const spicyChicken = candidate({
      candidateId: 'wendys-spicy-chicken',
      canonicalName: "Wendy's Spicy Chicken Sandwich",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_spicy_chicken',
    });

    const result = validateFoodIdentity(
      intent({
        rawText: 'I had a wendys baconator',
        searchText: "Wendy's Baconator",
        restaurant: "Wendy's",
        brand: "Wendy's",
      }),
      spicyChicken,
      [spicyChicken],
    );

    expect(result.decision).toBe('reject');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'product_family_conflict',
      'missing_protected_product_token:baconator',
    ]));
  });

  it('rejects McDouble no cheese resolved to McChicken even with matching modifiers', () => {
    const mcChicken = candidate({
      candidateId: 'mcdonalds-mcchicken',
      canonicalName: "McDonald's McChicken without cheese",
      restaurant: "McDonald's",
      brand: "McDonald's",
      productFamilyId: 'mcdonalds_mcchicken',
    });

    const result = validateFoodIdentity(
      intent({
        rawText: 'McDouble no cheese',
        searchText: "McDonald's McDouble",
        restaurant: "McDonald's",
        brand: "McDonald's",
        modifiers: ['no cheese'],
      }),
      mcChicken,
      [mcChicken],
    );

    expect(result.decision).toBe('reject');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'product_family_conflict',
      'missing_protected_product_token:mcdouble',
    ]));
  });

  it('rejects LLM selections that are not in the retrieved candidate set', () => {
    const selected = candidate({ candidateId: 'model-invented-baconator', canonicalName: "Wendy's Baconator" });
    const retrieved = candidate({ candidateId: 'catalog-baconator', canonicalName: "Wendy's Baconator" });

    const result = validateFoodIdentity(
      intent({ rawText: 'wendys baconator', searchText: "Wendy's Baconator", restaurant: "Wendy's" }),
      selected,
      [retrieved],
    );

    expect(result.decision).toBe('reject');
    expect(result.reasons).toContain('selected_candidate_not_in_candidate_set');
  });

  it('clarifies wrong-only candidate lists instead of selecting a bad review card', () => {
    const chicken = candidate({
      candidateId: 'wendys-chicken',
      canonicalName: "Wendy's Homestyle Chicken Fillet Sandwich",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_homestyle_chicken',
    });

    const result = resolveFoodCandidates({
      intent: intent({
        rawText: 'Wendys baconnator',
        searchText: "Wendy's Baconator",
        restaurant: "Wendy's",
        brand: "Wendy's",
      }),
      candidates: [chicken],
      selectedCandidateId: chicken.candidateId,
      llmUsed: true,
    });

    expect(result.status).toBe('needs_clarification');
    expect(result.selectedCandidate).toBeNull();
    expect(result.candidates).toHaveLength(1);
    expect(result.rejectedCandidates.map((entry) => entry.candidateId)).toEqual([chicken.candidateId]);
    expect(result.rejectionReasons).toEqual(expect.arrayContaining([
      'product_family_conflict',
      'missing_protected_product_token:baconator',
    ]));
    expect(result.debugTrace).toMatchObject({
      finalStatus: 'needs_clarification',
      llmUsed: true,
      llmResultAccepted: false,
    });
  });

  it('resolves only when the selected candidate is source-backed and identity-approved', () => {
    const baconator = candidate({
      candidateId: 'catalog:wendys_baconator',
      canonicalName: "Wendy's Baconator",
      restaurant: "Wendy's",
      brand: "Wendy's",
      productFamilyId: 'wendys_baconator',
      calories: 960,
      protein: 57,
      carbs: 38,
      fat: 66,
      sourceName: "Wendy's official nutrition",
    });

    const result = resolveFoodCandidates({
      intent: intent({
        rawText: 'I had a wendys baconator',
        searchText: "Wendy's Baconator",
        restaurant: "Wendy's",
        brand: "Wendy's",
      }),
      candidates: [baconator],
      selectedCandidateId: baconator.candidateId,
      llmUsed: false,
    });

    expect(result).toMatchObject({
      status: 'resolved',
      confidence: 'high',
      sourceTrust: 'official_restaurant',
      provenance: {
        sourceName: "Wendy's official nutrition",
        verified: true,
        estimated: false,
      },
    });
    expect(result.selectedCandidate?.candidateId).toBe(baconator.candidateId);
  });

  it('does not expose debug trace in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const baconator = candidate({ canonicalName: "Wendy's Baconator", restaurant: "Wendy's", brand: "Wendy's" });

    const result = resolveFoodCandidates({
      intent: intent({ rawText: 'wendys baconator', searchText: "Wendy's Baconator", restaurant: "Wendy's" }),
      candidates: [baconator],
      selectedCandidateId: baconator.candidateId,
    });

    expect(result.debugTrace).toBeUndefined();
  });
});

describe('critical catalog product family metadata', () => {
  it.each([
    ['wendys_baconator', 'wendys_baconator'],
    ['wendys_son_of_baconator', 'wendys_son_of_baconator'],
    ['wendys_spicy_chicken_sandwich', 'wendys_spicy_chicken'],
    ['wendys_homestyle_chicken_sandwich', 'wendys_homestyle_chicken'],
    ['mcdonalds_mcdouble', 'mcdonalds_mcdouble'],
    ['mcdonalds_mcdouble_no_cheese', 'mcdonalds_mcdouble'],
    ['mcdonalds_mcchicken', 'mcdonalds_mcchicken'],
    ['mcdonalds_big_mac', 'mcdonalds_big_mac'],
    ['subway_meatball_marinara_6in', 'subway_meatball_marinara'],
    ['subway_meatball_marinara_footlong', 'subway_meatball_marinara'],
    ['arbys_classic_roast_beef', 'arbys_roast_beef'],
    ['generic_grilled_chicken_breast', 'generic_grilled_chicken_breast'],
    ['generic_asparagus', 'generic_asparagus'],
    ['generic_buttered_corn_on_the_cob', 'generic_corn_on_the_cob'],
  ])('%s declares productFamilyId %s', (foodId, productFamilyId) => {
    expect(findCatalogFoodById(foodId)).toMatchObject({ productFamilyId });
  });
});
