'use client';

import { RouteErrorState } from '@/components/route-error-state';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      title="We hit a loading issue"
      description="The app could not finish this screen cleanly. A quick retry usually gets you back where you were."
      onRetry={reset}
    />
  );
}
