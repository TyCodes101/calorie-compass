import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyYesterdayButton } from '@/components/copy-yesterday-button';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

describe('copy yesterday button', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.restoreAllMocks();
  });

  it('uses an in-app confirmation modal before copying yesterday meals', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('native confirm should not be used');
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ copied: true, mealCount: 2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CopyYesterdayButton />);

    fireEvent.click(screen.getByRole('button', { name: /copy yesterday/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /copy yesterday/i })).toBeInTheDocument();
    expect(screen.getByText(/nothing saves until the copied meals are created for review/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy meals/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/meals/copy-yesterday', { method: 'POST' });
    });
    expect(await screen.findByText(/copied 2 meals/i)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
