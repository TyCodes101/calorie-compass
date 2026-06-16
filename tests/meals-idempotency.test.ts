import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      $transaction: vi.fn(async (callback: (tx: typeof tx) => unknown) => callback(tx)),
    },
    currentUser: {
      getCurrentUserWithProfile: vi.fn(),
    },
    dashboard: {
      upsertDailyLogForDate: vi.fn(),
    },
    catalogPersistence: {
      getPersistableCatalogFoodIds: vi.fn(),
    },
    persistence: {
      logConnectionReady: vi.fn(),
      logWriteFailure: vi.fn(),
      logWriteStart: vi.fn(),
      logWriteSuccess: vi.fn(),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/current-user', () => mocks.currentUser);
vi.mock('@/lib/dashboard', () => mocks.dashboard);
vi.mock('@/lib/catalog-persistence', () => mocks.catalogPersistence);
vi.mock('@/lib/persistence', () => mocks.persistence);

import { saveConfirmedMeal } from '@/lib/meals';

const savedMeal = {
  id: 'meal-1',
  items: [{ id: 'item-1' }],
  totalCalories: 340,
};

function payload(overrides = {}) {
  return {
    meal_type: 'lunch' as const,
    confidence_score: 0.95,
    raw_text: 'McDouble no cheese',
    idempotency_key: 'pending-1:v1',
    items: [{
      food_name: 'McDouble no cheese',
      quantity: 1,
      unit: 'burger',
      calories: 340,
      protein: 19,
      carbs: 31,
      fat: 15,
      fiber: 2,
      sugar: 7,
      sodium: 730,
      source_type: 'OFFICIAL_RESTAURANT' as const,
      source_name: "McDonald's official nutrition",
      catalog_food_id: 'mcdonalds_mcdouble',
    }],
    ...overrides,
  };
}

describe('meal save idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.getCurrentUserWithProfile.mockResolvedValue({ id: 'user-1' });
    mocks.catalogPersistence.getPersistableCatalogFoodIds.mockResolvedValue(new Set(['mcdonalds_mcdouble']));
    mocks.tx.meal.findFirst.mockResolvedValue(null);
    mocks.tx.meal.create.mockResolvedValue(savedMeal);
  });

  it('returns the existing meal for a repeated pending meal id/version', async () => {
    mocks.tx.meal.findFirst.mockResolvedValueOnce(savedMeal);

    const result = await saveConfirmedMeal(payload());

    expect(result).toBe(savedMeal);
    expect(mocks.tx.meal.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        idempotencyKey: 'pending-1:v1',
      },
      include: { items: true },
    });
    expect(mocks.tx.meal.create).not.toHaveBeenCalled();
    expect(mocks.dashboard.upsertDailyLogForDate).not.toHaveBeenCalled();
  });

  it('stores the idempotency key when creating a new meal', async () => {
    await saveConfirmedMeal(payload());

    expect(mocks.tx.meal.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        idempotencyKey: 'pending-1:v1',
      }),
      include: { items: true },
    }));
  });
});
