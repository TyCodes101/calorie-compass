'use client';

import { RouteErrorState } from '@/components/route-error-state';

export default function LoggerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      title="The logger needs another try"
      description="We could not load the meal review flow cleanly. Retry and you should be able to keep logging without losing your place."
      onRetry={reset}
    />
  );
}
