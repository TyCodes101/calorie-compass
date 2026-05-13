import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoalsSettingsForm, PreferencesSettingsForm } from '@/components/profile-settings-client';

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
});
