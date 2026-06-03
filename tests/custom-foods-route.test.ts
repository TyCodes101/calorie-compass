import { beforeEach, describe, expect, it, vi } from 'vitest';

const customFoodMocks = vi.hoisted(() => ({
  getCustomFoods: vi.fn(),
  createCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

const foodSearchMocks = vi.hoisted(() => ({
  customFoodToSearchResult: vi.fn(),
}));

vi.mock('@/lib/custom-foods', () => customFoodMocks);
vi.mock('@/lib/food-search', () => foodSearchMocks);

import { GET } from '@/app/api/custom-foods/route';
import { DELETE } from '@/app/api/custom-foods/[customFoodId]/route';

describe('custom foods routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    type CustomFoodRow = {
      id: string;
      name: string;
      brand?: string | null;
      barcode?: string | null;
    };

    foodSearchMocks.customFoodToSearchResult.mockImplementation((food: CustomFoodRow) => ({
      id: food.id,
      name: food.name,
      brand: food.brand ?? null,
      sourceLabel: 'Custom',
      servingQuantity: 1,
      servingUnit: 'serving',
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 3,
      barcode: food.barcode ?? null,
      mealType: 'snack',
      confidenceScore: 1,
      sourceReusableMealId: null,
      items: [],
    }));
  });

  it('lists custom foods as a stable array payload', async () => {
    customFoodMocks.getCustomFoods.mockResolvedValue([
      { id: 'food-1', name: 'Test Food', brand: 'Brand', barcode: null },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.customFoods).toHaveLength(1);
    expect(payload.customFoods[0]).toMatchObject({
      id: 'food-1',
      name: 'Test Food',
      brand: 'Brand',
    });
  });

  it('deletes a custom food by id', async () => {
    customFoodMocks.deleteCustomFood.mockResolvedValue(undefined);

    const response = await DELETE(new Request('http://localhost/api/custom-foods/food-1', { method: 'DELETE' }), {
      params: Promise.resolve({ customFoodId: 'food-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(customFoodMocks.deleteCustomFood).toHaveBeenCalledWith('food-1');
  });
});
