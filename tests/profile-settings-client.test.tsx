import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountSettingsForm, GoalsSettingsForm, PreferencesSettingsForm } from '@/components/profile-settings-client';

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('profile settings client flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it('saves preferences to device storage', async () => {
    render(<PreferencesSettingsForm />);

    await screen.findByText('Save preferences');

    fireEvent.change(screen.getByLabelText('Default start screen'), {
      target: { value: 'history' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('calorie-compass.preferences') || '{}')).toMatchObject({
        defaultScreen: 'history',
      });
    });
  });

  it('sends profile goal updates through the PATCH profile route', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <GoalsSettingsForm
        initial={{
          name: 'Tyler',
          age: 21,
          heightCm: 180,
          weightLbs: 180,
          goal: 'MAINTAIN',
          activityLevel: 'MODERATE',
          dailyCalorieGoal: 2200,
          proteinGoal: 160,
          nutritionPreferences: 'high protein',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /build muscle/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save goals' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
        }),
      );
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        body: JSON.stringify({
          goal: 'GAIN_MUSCLE',
          activityLevel: 'MODERATE',
        }),
      }),
    );
  });

  it('saves nutrition preferences through the account settings PATCH flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <AccountSettingsForm
        initial={{
          name: 'Tyler',
          age: 21,
          heightCm: 180,
          weightLbs: 180,
          goal: 'MAINTAIN',
          activityLevel: 'MODERATE',
          dailyCalorieGoal: 2200,
          proteinGoal: 160,
          nutritionPreferences: 'high protein',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nutrition preferences'), {
      target: { value: 'high protein, quick breakfast' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save account changes' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            name: 'Tyler',
            nutritionPreferences: 'high protein, quick breakfast',
          }),
        }),
      );
    });
  });

  it('shows guest account foundation messaging and planned auth providers', () => {
    render(
      <AccountSettingsForm
        initial={{
          name: 'Tyler',
          age: 21,
          heightCm: 180,
          weightLbs: 180,
          goal: 'MAINTAIN',
          activityLevel: 'MODERATE',
          dailyCalorieGoal: 2200,
          proteinGoal: 160,
          nutritionPreferences: 'high protein',
        }}
        account={{
          mode: 'guest',
          title: 'Guest mode is active',
          description: 'Meals and profile data stay tied to this device session right now.',
          persistenceLabel: 'Live guest session with saved history',
          providers: [
            {
              id: 'apple',
              label: 'Continue with Apple',
              status: 'planned',
              detail: 'Architecture is ready for Apple sign-in wiring when provider credentials are added.',
            },
            {
              id: 'google',
              label: 'Continue with Google',
              status: 'planned',
              detail: 'Architecture is ready for Google sign-in wiring when provider credentials are added.',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/guest mode is active/i)).toBeInTheDocument();
    expect(screen.getByText(/live guest session with saved history/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with apple/i)).toBeInTheDocument();
    expect(screen.getByText(/continue with google/i)).toBeInTheDocument();
  });

  it('frames reset as meal-history cleanup instead of demo data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    vi.stubGlobal('fetch', fetchMock);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('native confirm should not be used');
    });

    render(
      <AccountSettingsForm
        initial={{
          name: 'Tyler',
          age: 21,
          heightCm: 180,
          weightLbs: 180,
          goal: 'MAINTAIN',
          activityLevel: 'MODERATE',
          dailyCalorieGoal: 2200,
          proteinGoal: 160,
          nutritionPreferences: 'high protein',
        }}
      />,
    );

    expect(screen.getByText(/reset clears logged meals/i)).toBeInTheDocument();
    expect(screen.queryByText(/reset demo data/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset meal history' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: /reset meal history/i });
    expect(within(dialog).getByText(/your profile, goals, and nutrition preferences will stay in place/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /reset history/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/profile/reset', { method: 'POST' });
    });

    expect(await screen.findByText(/meal history reset/i)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
