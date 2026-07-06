import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { DuplicateMealSaveError, saveConfirmedMeal } from '@/lib/meals';

const mocks = vi.hoisted(() => {
  const tx = {
    meal: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    reusableMeal: {
      updateMany: vi.fn(),
    },
  };
  return {
    tx,
    prisma: {
      $connect: vi.fn(),
      $transaction: vi.fn(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx)),
      meal: {
        findFirst: vi.fn(),
      },
    },
    getCurrentUserWithProfile: vi.fn(),
    getPersistableCatalogFoodIds: vi.fn(),
    upsertDailyLogForDate: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/current-user', () => ({ getCurrentUserWithProfile: mocks.getCurrentUserWithProfile }));
vi.mock('@/lib/catalog-persistence', () => ({ getPersistableCatalogFoodIds: mocks.getPersistableCatalogFoodIds }));
vi.mock('@/lib/dashboard', () => ({ upsertDailyLogForDate: mocks.upsertDailyLogForDate }));

function foodItem(overrides?: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'McDouble',
    quantity: 1,
    unit: 'burger',
    calories: 390,
    protein: 22,
    carbs: 33,
    fat: 19,
    fiber: 2,
    sugar: 7,
    sodium: 850,
    notes: 'Official item.',
    is_trusted: true,
    source_type: 'OFFICIAL_RESTAURANT',
    source_name: "McDonald's official nutrition",
    confidence_label: 'Verified',
    matched_query: "McDonald's McDouble",
    original_user_text: 'McDouble no cheese',
    provider_used: 'local-verified-catalog',
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

const payload = {
  meal_type: 'lunch' as const,
  confidence_score: 0.95,
  raw_text: 'McDouble no cheese',
  pending_meal_id: 'pending-abc',
  pending_meal_version: 2,
  idempotency_key: 'pending-abc:v2',
  items: [foodItem()],
};

describe('saveConfirmedMeal idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserWithProfile.mockResolvedValue({ id: 'user-1' });
    mocks.getPersistableCatalogFoodIds.mockResolvedValue(new Set());
    mocks.tx.meal.findFirst.mockResolvedValue(null);
    mocks.tx.meal.create.mockResolvedValue({
      id: 'meal-new',
      totalCalories: 390,
      items: [{ id: 'item-1' }],
    });
  });

  it('rejects a duplicate idempotency key before creating another meal', async () => {
    mocks.tx.meal.findFirst.mockResolvedValueOnce({ id: 'meal-existing' });

    const promise = saveConfirmedMeal(payload);

    await expect(promise).rejects.toBeInstanceOf(DuplicateMealSaveError);
    await expect(promise).rejects.toMatchObject({ existingMealId: 'meal-existing' });
    expect(mocks.tx.meal.create).not.toHaveBeenCalled();
  });

  it('persists pending meal metadata on first save', async () => {
    await expect(saveConfirmedMeal(payload)).resolves.toMatchObject({ id: 'meal-new' });

    expect(mocks.tx.meal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pendingMealId: 'pending-abc',
        pendingMealVersion: 2,
        idempotencyKey: 'pending-abc:v2',
      }),
    }));
  });
});
