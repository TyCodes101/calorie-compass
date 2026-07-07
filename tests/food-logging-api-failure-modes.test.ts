import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUserWithProfile: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
  runMealAssistant: vi.fn(),
  saveConfirmedMeal: vi.fn(),
  getDashboardData: vi.fn(),
  getDatabaseDebugInfo: vi.fn(() => ({})),
  getPersistenceErrorMessage: vi.fn(() => 'We could not save that meal right now.'),
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
  getDatabaseDebugInfo: mocks.getDatabaseDebugInfo,
  getPersistenceErrorMessage: mocks.getPersistenceErrorMessage,
  isDatabaseWriteError: mocks.isDatabaseWriteError,
  logWriteFailure: mocks.logWriteFailure,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { POST as postMealAssistant } from '@/app/api/meal-assistant/route';
import { POST as postMeal } from '@/app/api/meals/route';

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
});
