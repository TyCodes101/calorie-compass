import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUserWithProfile: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
  runMealAssistant: vi.fn(),
  saveConfirmedMeal: vi.fn(),
  getDashboardData: vi.fn(),
  getDatabaseDebugInfo: vi.fn(() => ({})),
  getPersistenceErrorMessage: vi.fn(() => 'We could not save that meal right now.'),
  createPersistenceTraceId: vi.fn(() => 'trace-meal-test'),
  isDatabaseWriteError: vi.fn(() => false),
  logWriteFailure: vi.fn(),
  prisma: {
    meal: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/current-user', () => ({
  getCurrentUserWithProfile: mocks.getCurrentUserWithProfile,
  hasDatabaseConnectionString: mocks.hasDatabaseConnectionString,
}));

vi.mock('@/lib/ai/runMealAssistant', () => ({
  runMealAssistant: mocks.runMealAssistant,
}));

vi.mock('@/lib/meals', () => {
  class DuplicateMealSaveError extends Error {
    constructor(readonly existingMealId: string) {
      super('Meal was already saved for this pending review.');
      this.name = 'DuplicateMealSaveError';
    }
  }

  return {
    DuplicateMealSaveError,
    saveConfirmedMeal: mocks.saveConfirmedMeal,
  };
});

vi.mock('@/lib/dashboard', () => ({
  getDashboardData: mocks.getDashboardData,
}));

vi.mock('@/lib/persistence', () => ({
  createPersistenceTraceId: mocks.createPersistenceTraceId,
  getDatabaseDebugInfo: mocks.getDatabaseDebugInfo,
  getPersistenceErrorMessage: mocks.getPersistenceErrorMessage,
  isDatabaseWriteError: mocks.isDatabaseWriteError,
  logWriteFailure: mocks.logWriteFailure,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST as postMealAssistant } from '@/app/api/meal-assistant/route';
import { GET as getMeals, POST as postMeal } from '@/app/api/meals/route';

function request(path: string, body: string | unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('food logging API failure modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseConnectionString.mockReturnValue(true);
  });

  it('rejects malformed meal assistant JSON as a client error before running the assistant', async () => {
    const response = await postMealAssistant(request('/api/meal-assistant', '{"message":'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/request/i);
    expect(mocks.getCurrentUserWithProfile).not.toHaveBeenCalled();
    expect(mocks.runMealAssistant).not.toHaveBeenCalled();
  });

  it('rejects invalid meal assistant request shape before running the assistant', async () => {
    const response = await postMealAssistant(request('/api/meal-assistant', { message: 'save it' }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/request/i);
    expect(mocks.getCurrentUserWithProfile).not.toHaveBeenCalled();
    expect(mocks.runMealAssistant).not.toHaveBeenCalled();
  });

  it('sanitizes lower-level OpenAI errors before returning meal assistant failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getCurrentUserWithProfile.mockResolvedValue(null);
    mocks.runMealAssistant.mockRejectedValue(
      new Error('OpenAI 401 invalid key sk-test-secret-key raw prompt: Wendy Baconator model=gpt-4.1-mini'),
    );

    const response = await postMealAssistant(request('/api/meal-assistant', {
      message: "Wendy's Baconator",
      state: {
        currentMealItems: [],
        pendingMeal: null,
        pendingClarification: null,
        lastAssistantQuestion: null,
        userCorrections: [],
        saved: false,
        mealType: 'dinner',
        userName: null,
        currentMealText: null,
        confidenceScore: 0.82,
      },
      context: {
        favoriteMeals: [],
        recentMeals: [],
        nutritionPreferences: null,
      },
      conversationHistory: [],
    }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'We could not update that meal right now. Please try again.' });
    expect(JSON.stringify(payload)).not.toMatch(/sk-test-secret-key|Wendy Baconator|gpt-4\.1|OpenAI|raw prompt|401/i);
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/sk-test-secret-key|Wendy Baconator|raw prompt/i);
  });

  it('rejects malformed save JSON as a client error before persistence', async () => {
    const response = await postMeal(request('/api/meals', '{"items":'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/meal/i);
    expect(mocks.saveConfirmedMeal).not.toHaveBeenCalled();
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });

  it('rejects empty save payloads before persistence', async () => {
    const response = await postMeal(request('/api/meals', {
      meal_type: 'lunch',
      confidence_score: 0.8,
      items: [],
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/meal/i);
    expect(mocks.saveConfirmedMeal).not.toHaveBeenCalled();
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });

  it('returns a traceable save failure when meal persistence fails', async () => {
    const databaseError = new Error('column "pendingMealId" of relation "Meal" does not exist');
    mocks.isDatabaseWriteError.mockReturnValue(true);
    mocks.saveConfirmedMeal.mockRejectedValue(databaseError);

    const response = await postMeal(request('/api/meals', {
      meal_type: 'dinner',
      confidence_score: 0.78,
      raw_text: 'Panda Express Bigger Plate',
      pending_meal_id: 'pending-panda',
      pending_meal_version: 2,
      idempotency_key: 'pending-panda:v2',
      items: [
        {
          food_name: 'Panda Express Orange Chicken',
          quantity: 1,
          unit: 'serving',
          calories: 490,
          protein: 13,
          carbs: 51,
          fat: 23,
          fiber: 2,
          sugar: 19,
          sodium: 820,
          source_type: 'OFFICIAL_RESTAURANT',
          source_name: 'Panda Express official nutrition',
          confidence_label: 'Verified',
        },
      ],
    }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: 'We could not save that meal right now.',
      code: 'MEAL_SAVE_FAILED',
      traceId: 'trace-meal-test',
    });
    expect(mocks.logWriteFailure).toHaveBeenCalledWith('meal.route', databaseError, expect.objectContaining({
      traceId: 'trace-meal-test',
      stage: 'meal.save',
      pendingMealId: 'pending-panda',
      idempotencyKey: 'pending-panda:v2',
      itemCount: 1,
    }));
  });

  it('returns a traceable history failure when saved meals cannot be loaded', async () => {
    const databaseError = new Error('column "pendingMealId" does not exist');
    mocks.getCurrentUserWithProfile.mockResolvedValue({ id: 'user-1' });
    mocks.prisma.meal.findMany.mockRejectedValue(databaseError);

    const response = await getMeals();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      error: 'We couldn\u2019t load your saved meals right now. Please try again.',
      code: 'MEAL_HISTORY_LOAD_FAILED',
      traceId: 'trace-meal-test',
    });
    expect(mocks.logWriteFailure).toHaveBeenCalledWith('meal.route.get', databaseError, expect.objectContaining({
      traceId: 'trace-meal-test',
      stage: 'meal.history.load',
      userId: 'user-1',
    }));
  });
});
