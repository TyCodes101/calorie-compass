'use client';

import { RouteErrorState } from '@/components/route-error-state';

export default function InsightsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      title="Insights could not load"
      description="Your nutrition data is still saved. Retry to rebuild the weekly pattern view."
      onRetry={reset}
    />
  );
}
