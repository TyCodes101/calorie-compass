import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import type { ParsedFoodItem } from '@/lib/ai/types';
import { searchFoodIntelligence } from '@/lib/food-intelligence/engine';
import { createFoodSearchDiagnostics, resetFoodSearchCaches } from '@/lib/food-search';
import { NutritionProviderError } from '@/lib/nutrition/providers/providerHttp';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

type FixtureFood = {
  name: string;
  calories: number;
  unit?: string;
};

const fixtureFoods: FixtureFood[] = [
  { name: 'KitKat Milk Chocolate', calories: 210, unit: 'bar' },
  { name: 'KitKat King Size', calories: 420, unit: 'package' },
  { name: 'KitKat Mini', calories: 90, unit: 'piece' },
  { name: 'KitKat White Creme', calories: 220, unit: 'bar' },
  { name: 'Quest Nacho Cheese Protein Chips', calories: 150, unit: 'bag' },
  { name: 'Grilled chicken breast', calories: 190, unit: 'breast' },
  { name: "McDonald's McDouble", calories: 400, unit: 'burger' },
  { name: 'Chipotle Chicken Bowl', calories: 620, unit: 'bowl' },
  { name: 'Subway Meatball Footlong', calories: 960, unit: 'footlong' },
  { name: "Cheetos Crunchy Flamin' Hot", calories: 170, unit: 'bag' },
];

function normalizedText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fixtureMatches(query: string, food: FixtureFood) {
  const queryTokens = normalizedText(query).split(' ').filter(Boolean);
  const foodTokens = normalizedText(food.name).split(' ').filter(Boolean);
  const compactQuery = queryTokens.join('');
  const compactFood = foodTokens.join('');
  return compactQuery.length >= 2 && compactFood.includes(compactQuery)
    || queryTokens.every((token) => foodTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate)));
}

function foodItem(food: FixtureFood, providerId = 'fixture-database'): ParsedFoodItem {
  return {
    food_name: food.name,
    quantity: 1,
    unit: food.unit ?? 'serving',
    calories: food.calories,
    protein: 10,
    carbs: 20,
    fat: 8,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Controlled provider fixture',
    confidence_label: 'Matched',
    provider_used: providerId,
    used_ai_fallback: false,
  };
}

function response(food: FixtureFood, providerId = 'fixture-database') {
  return normalizeParsedMealResponse({
    needs_clarification: false,
    clarifying_question: null,
    meal_type: 'snack',
    confidence_score: 0.9,
    items: [foodItem(food, providerId)],
  });
}

function fixtureProvider(): NutritionLookupProvider {
  return {
    id: 'fixture-database',
    capabilities: { search: true, barcode: false, details: false, suggest: true },
    getStatus: () => ({ configured: true }),
    lookup: vi.fn().mockResolvedValue(null),
    searchCandidates: vi.fn(async ({ normalizedQuery }) => fixtureFoods
      .filter((food) => fixtureMatches(normalizedQuery.searchText, food))
      .map((food) => response(food))),
  };
}

const noAi = {
  resolveQuery: vi.fn().mockResolvedValue(null),
  rankCandidates: vi.fn().mockResolvedValue(null),
};

describe('food search production regressions', () => {
  beforeEach(() => {
    resetFoodSearchCaches();
    vi.clearAllMocks();
  });

  it.each([
    ['Kit', /KitKat Milk Chocolate/i, 4],
    ['Kit kat', /KitKat Milk Chocolate/i, 4],
    ['KitKat', /KitKat Milk Chocolate/i, 4],
    ['Quest', /Quest Nacho Cheese Protein Chips/i, 1],
    ['Chicken', /Grilled chicken breast/i, 1],
    ['Mc', /McDonald.*McDouble/i, 1],
    ['Chip', /Chipotle Chicken Bowl/i, 1],
    ['Sub', /Subway Meatball Footlong/i, 1],
    ['hot cheeots', /Cheetos Crunchy Flamin.*Hot/i, 1],
    ['Chipolte', /Chipotle Chicken Bowl/i, 1],
    ['mcdonlads', /McDonald.*McDouble/i, 1],
  ])('returns normalized database candidates for %s', async (query, expected, minimumCount) => {
    const result = await searchFoodIntelligence({ query, origin: 'search' }, {
      search: { providers: [fixtureProvider()], catalogFoods: [], ai: noAi },
    });

    expect(result.results.length).toBeGreaterThanOrEqual(minimumCount);
    expect(result.results[0]?.name).toMatch(expected);
    expect(result.results[0]).toMatchObject({ estimated: false, needsReview: false, providerId: 'fixture-database' });
  });

  it('records sanitized provider outcomes and the winning candidate in development diagnostics', async () => {
    const diagnostics = createFoodSearchDiagnostics('Kit');
    const healthy = fixtureProvider();
    const failedLookup = vi.fn().mockRejectedValue(new NutritionProviderError('timeout', { status: 504 }));
    const failed: NutritionLookupProvider = {
      id: 'timed-out-provider',
      getStatus: () => ({ configured: true }),
      lookup: failedLookup,
    };
    const disabled: NutritionLookupProvider = {
      id: 'disabled-provider',
      getStatus: () => ({ configured: false, reason: 'missing_credentials' }),
      lookup: vi.fn(),
    };
    const unsupported: NutritionLookupProvider = {
      id: 'barcode-only-provider',
      capabilities: { search: false, barcode: true, details: false, suggest: false },
      getStatus: () => ({ configured: true }),
      lookup: vi.fn(),
    };

    const result = await searchFoodIntelligence({ query: 'Kit', origin: 'search' }, {
      search: { providers: [disabled, unsupported, failed, healthy], catalogFoods: [], ai: noAi, diagnostics },
    });

    expect(result.results[0]?.name).toBe('KitKat Milk Chocolate');
    expect(diagnostics).toMatchObject({
      normalizedQuery: 'Kit',
      mergedCandidateCount: 4,
      finalCandidateCount: 4,
      winningCandidate: 'KitKat Milk Chocolate',
    });
    expect(diagnostics.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'disabled-provider', configured: false, attempted: false, outcome: 'not_configured', httpStatus: null }),
      expect.objectContaining({ provider: 'barcode-only-provider', attempted: false, outcome: 'unsupported', httpStatus: null }),
      expect.objectContaining({ provider: 'timed-out-provider', attempted: true, outcome: 'failed', httpStatus: 504, reason: 'timeout' }),
      expect.objectContaining({ provider: 'fixture-database', attempted: true, outcome: 'matched', candidateCount: 4, httpStatus: null }),
    ]));
    expect(failedLookup).toHaveBeenCalledOnce();
    expect(JSON.stringify(diagnostics)).not.toMatch(/authorization|api[-_ ]?key|secret/i);
  });

  it('ranks all provider candidates before applying the result limit', async () => {
    const provider: NutritionLookupProvider = {
      id: 'large-provider-result',
      lookup: vi.fn().mockResolvedValue(null),
      searchCandidates: vi.fn().mockResolvedValue([
        ...Array.from({ length: 24 }, (_, index) => response({ name: `Chocolate snack ${index}`, calories: 100 + index }, 'large-provider-result')),
        response({ name: 'KitKat Milk Chocolate', calories: 210, unit: 'bar' }, 'large-provider-result'),
      ]),
    };

    const result = await searchFoodIntelligence({ query: 'Kit', origin: 'search' }, {
      search: { providers: [provider], catalogFoods: [], ai: noAi },
    });

    expect(result.results).toHaveLength(10);
    expect(result.results[0]?.name).toBe('KitKat Milk Chocolate');
  });

  it('keeps provider results when both OpenAI search stages fail', async () => {
    const aiFailure = new Error('simulated OpenAI outage');
    const result = await searchFoodIntelligence({ query: 'Kit', origin: 'search' }, {
      search: {
        providers: [fixtureProvider()],
        catalogFoods: [],
        ai: {
          resolveQuery: vi.fn().mockRejectedValue(aiFailure),
          rankCandidates: vi.fn().mockRejectedValue(aiFailure),
        },
      },
    });

    expect(result.results[0]).toMatchObject({ name: 'KitKat Milk Chocolate', providerId: 'fixture-database', estimated: false });
  });
});
