import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveProfile, getCurrentUserWithProfile } = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  getCurrentUserWithProfile: vi.fn(),
}));

vi.mock('@/lib/profile', () => ({
  saveProfile,
}));

vi.mock('@/lib/current-user', () => ({
  getCurrentUserWithProfile,
}));

import { PATCH } from '@/app/api/profile/route';

describe('profile PATCH route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserWithProfile.mockResolvedValue({
      id: 'user_1',
      name: 'Tyler',
      profile: {
        age: 21,
        heightCm: 180,
        weightLbs: 180,
        goal: 'MAINTAIN',
        activityLevel: 'MODERATE',
        dailyCalorieGoal: 2200,
        proteinGoal: 160,
        aiPreferenceNotes: 'high protein',
      },
    });
    saveProfile.mockResolvedValue({ id: 'user_1' });
  });

  it('merges partial updates with the existing profile snapshot', async () => {
    const request = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyCalorieGoal: 2400 }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(saveProfile).toHaveBeenCalledWith({
      name: 'Tyler',
      age: 21,
      heightCm: 180,
      weightLbs: 180,
      goal: 'MAINTAIN',
      activityLevel: 'MODERATE',
      dailyCalorieGoal: 2400,
      proteinGoal: 160,
      nutritionPreferences: 'high protein',
    });
  });

  it('accepts nutrition preference updates in partial patches', async () => {
    const request = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nutritionPreferences: 'high protein, quick breakfast' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(saveProfile).toHaveBeenCalledWith({
      name: 'Tyler',
      age: 21,
      heightCm: 180,
      weightLbs: 180,
      goal: 'MAINTAIN',
      activityLevel: 'MODERATE',
      dailyCalorieGoal: 2200,
      proteinGoal: 160,
      nutritionPreferences: 'high protein, quick breakfast',
    });
  });

  it('rejects empty patches with a friendly error', async () => {
    const request = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'We couldn’t save your profile right now. Please try again.' });
    expect(saveProfile).not.toHaveBeenCalled();
  });
});
