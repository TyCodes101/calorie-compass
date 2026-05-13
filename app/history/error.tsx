'use client';

import { RouteErrorState } from '@/components/route-error-state';

export default function HistoryError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      title="History is not available right now"
      description="Your saved meals are still intact, but this screen could not load cleanly. Retry to refresh your timeline."
      onRetry={reset}
    />
  );
}
