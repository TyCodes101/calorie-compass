import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentUserMocks = vi.hoisted(() => ({
  getCurrentUserWithProfile: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
}));

const dashboardMocks = vi.hoisted(() => ({
  getDashboardData: vi.fn(),
}));

vi.mock('@/lib/current-user', () => currentUserMocks);

vi.mock('@/lib/dashboard', () => dashboardMocks);

import { POST } from '@/app/api/meals/route';

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/meals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('meals route native save contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserMocks.hasDatabaseConnectionString.mockReturnValue(false);
    currentUserMocks.getCurrentUserWithProfile.mockResolvedValue({
      id: 'user-1',
      name: 'Tyler',
      profile: { id: 'profile-1', userId: 'user-1' },
    });
    dashboardMocks.getDashboardData.mockResolvedValue({ totals: { calories: 0 } });
  });

  it('accepts the exact Chick-fil-A review-card payload from TestFlight', async () => {
    const response = await POST(buildRequest({
      meal_type: 'lunch',
      confidence_score: 0.96,
      raw_text: 'I had 2 chic fil a chciken sandwhiches',
      items: [{
        food_name: 'Chick-fil-A Chicken Sandwich',
        quantity: 2,
        unit: 'sandwich',
        calories: 840,
        protein: 58,
        carbs: 82,
        fat: 36,
        fiber: 4,
        sugar: 12,
        sodium: 2920,
        notes: 'Matched to trusted restaurant catalog entry.',
        source_type: 'OFFICIAL_RESTAURANT',
        source_name: 'Chick-fil-A official nutrition',
        confidence_label: 'Verified',
        is_trusted: true,
        catalog_food_id: 'chickfila_chicken_sandwich',
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meal.items[0]).toMatchObject({
      food_name: 'Chick-fil-A Chicken Sandwich',
      quantity: 2,
      source_type: 'OFFICIAL_RESTAURANT',
      confidence_label: 'Verified',
    });
  });

  it('normalizes legacy native source types instead of rejecting an otherwise valid meal', async () => {
    const response = await POST(buildRequest({
      meal_type: 'snack',
      confidence_score: 0.9,
      raw_text: 'one banana',
      items: [{
        food_name: 'banana',
        quantity: 1,
        unit: 'medium',
        calories: 105,
        protein: 1,
        carbs: 27,
        fat: 0,
        fiber: 3,
        sugar: 14,
        sodium: 1,
        notes: null,
        source_type: 'USDA_FOUNDATION',
        source_name: 'USDA FoodData Central',
        confidence_label: 'High',
        is_trusted: true,
        catalog_food_id: null,
      }],
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meal.items[0]).toMatchObject({
      food_name: 'banana',
      source_type: 'GENERIC_REFERENCE',
      confidence_label: 'Matched',
      is_trusted: true,
    });
  });
});
