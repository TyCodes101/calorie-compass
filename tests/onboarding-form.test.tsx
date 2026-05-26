import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OnboardingForm } from '@/components/onboarding-form';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe('onboarding form', () => {
  beforeEach(() => {
    window.localStorage.clear();
    pushMock.mockReset();
    refreshMock.mockReset();
    vi.restoreAllMocks();
  });

  it('saves profile basics, nutrition preferences, and completion state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <OnboardingForm
        initial={{
          name: 'Tyler',
          goal: 'LOSE_WEIGHT',
          activityLevel: 'MODERATE',
          dailyCalorieGoal: 2300,
          proteinGoal: 180,
          nutritionPreferences: '',
        }}
      />,
    );

    expect(screen.getByText(/food logger that thinks with you/i)).toBeInTheDocument();
    expect(screen.getByText(/Review before save/i)).toBeInTheDocument();
    expect(screen.getByText(/Source-aware estimates/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('What should we call you?'), {
      target: { value: 'Tyler' },
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByLabelText('Nutrition preferences, optional'), {
      target: { value: 'high protein, lighter dairy when possible' },
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/partial serving and branded shake separate/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start logging/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        body: expect.stringContaining('lighter dairy when possible'),
      }),
    );

    expect(window.localStorage.getItem('calorie-compass.onboarding-complete')).toBe('true');
    expect(pushMock).toHaveBeenCalledWith('/logger');
    expect(refreshMock).toHaveBeenCalled();
  });
});
