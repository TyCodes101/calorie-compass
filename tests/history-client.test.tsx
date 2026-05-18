import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HistoryClient, formatHistoryCounts, formatMealSourceSummary } from '@/components/history-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
});

describe('history client copy helpers', () => {
  it('formats history counts without awkward plurals', () => {
    expect(formatHistoryCounts(0, 0)).toBe('0 favorites, 0 logged meals');
    expect(formatHistoryCounts(1, 1)).toBe('1 favorite, 1 logged meal');
    expect(formatHistoryCounts(2, 3)).toBe('2 favorites, 3 logged meals');
  });

  it('describes structured source coverage clearly', () => {
    expect(formatMealSourceSummary(1, 0)).toBe('1 structured match, 0 estimates');
    expect(formatMealSourceSummary(2, 1)).toBe('2 structured matches, 1 estimate');
  });

  it('does not show the offline banner when navigator is stale but the app can reach production assets', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    render(<HistoryClient initialHistory={[]} initialFavorites={[]} initialNotice={null} />);

    await waitFor(() => expect(screen.queryByText(/you are offline right now/i)).not.toBeInTheDocument());
  });

  it('shows the offline banner only after network confirmation fails', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<HistoryClient initialHistory={[]} initialFavorites={[]} initialNotice={null} />);

    expect(await screen.findByText(/you are offline right now/i)).toBeInTheDocument();
  });
});
