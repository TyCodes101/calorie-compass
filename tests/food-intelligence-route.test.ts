import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCustomFoods, getReusableMealLibrary, revalidateFoodIntelligenceItems } = vi.hoisted(() => ({
  getCustomFoods: vi.fn(),
  getReusableMealLibrary: vi.fn(),
  revalidateFoodIntelligenceItems: vi.fn(),
}));

vi.mock('@/lib/custom-foods', () => ({ getCustomFoods }));
vi.mock('@/lib/reusable-meals', () => ({ getReusableMealLibrary }));
vi.mock('@/lib/food-intelligence/engine', () => ({ revalidateFoodIntelligenceItems }));
vi.mock('@/lib/persistence', () => ({ logWriteFailure: vi.fn() }));

import { POST } from '@/app/api/food-intelligence/revalidate/route';

const storedItem = {
  food_name: 'KitKat Milk Chocolate',
  quantity: 1,
  unit: 'bar',
  calories: 210,
  protein: 3,
  carbs: 27,
  fat: 11,
  fiber: 1,
  sugar: 21,
  sodium: 30,
};

describe('food intelligence revalidation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCustomFoods.mockResolvedValue([]);
    getReusableMealLibrary.mockResolvedValue({ favoriteMeals: [], recentMeals: [] });
  });

  it('returns a review payload without saving the stored meal', async () => {
    const review = {
      origin: 'history',
      mealType: 'snack',
      items: [storedItem],
      confidenceScore: 0.86,
      needsReview: false,
      unresolvedItems: [],
    };
    revalidateFoodIntelligenceItems.mockResolvedValue(review);

    const response = await POST(new Request('http://localhost/api/food-intelligence/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'history', mealType: 'snack', items: [storedItem] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(review);
    expect(revalidateFoodIntelligenceItems).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'history',
      mealType: 'snack',
      items: [storedItem],
    }));
  });

  it('rejects unsupported origins and empty meals before provider work begins', async () => {
    const response = await POST(new Request('http://localhost/api/food-intelligence/revalidate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'chat', mealType: 'snack', items: [] }),
    }));

    expect(response.status).toBe(400);
    expect(revalidateFoodIntelligenceItems).not.toHaveBeenCalled();
  });
});
