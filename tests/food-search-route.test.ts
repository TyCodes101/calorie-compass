import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCustomFoods: vi.fn(),
  getReusableMealLibrary: vi.fn(),
  searchFoodIntelligence: vi.fn(),
}));

vi.mock('@/lib/custom-foods', () => ({ getCustomFoods: mocks.getCustomFoods }));
vi.mock('@/lib/reusable-meals', () => ({ getReusableMealLibrary: mocks.getReusableMealLibrary }));
vi.mock('@/lib/food-intelligence/engine', () => ({ searchFoodIntelligence: mocks.searchFoodIntelligence }));

import { GET } from '@/app/api/food-search/route';

const responseBody = {
  query: 'Kit',
  normalizedQuery: 'Kit',
  results: [],
  clarificationQuestion: null,
  usedResolver: false,
  usedRanking: false,
  cache: { resolverHit: false, rankingHit: false, selectedResultHit: false },
};

describe('food search route diagnostics', () => {
  beforeEach(() => {
    mocks.getCustomFoods.mockResolvedValue([]);
    mocks.getReusableMealLibrary.mockResolvedValue({ favoriteMeals: [], recentMeals: [] });
    mocks.searchFoodIntelligence.mockImplementation(async (_input, dependencies) => {
      const diagnostics = dependencies?.search?.diagnostics;
      if (diagnostics) {
        diagnostics.winningCandidate = 'KitKat Milk Chocolate';
        diagnostics.finalCandidateCount = 1;
      }
      return responseBody;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns sanitized pipeline diagnostics only when explicitly enabled outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('FOOD_SEARCH_DEBUG', '1');

    const response = await GET(new Request('http://localhost/api/food-search?q=Kit'));
    const body = await response.json();

    expect(body.pipeline_debug).toMatchObject({ winningCandidate: 'KitKat Milk Chocolate', finalCandidateCount: 1 });
  });

  it('never exposes pipeline diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FOOD_SEARCH_DEBUG', '1');

    const response = await GET(new Request('http://localhost/api/food-search?q=Kit'));
    const body = await response.json();

    expect(body).not.toHaveProperty('pipeline_debug');
    expect(mocks.searchFoodIntelligence).toHaveBeenCalledWith(expect.anything(), undefined);
  });
});
