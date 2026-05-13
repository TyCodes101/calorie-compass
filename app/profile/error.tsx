'use client';

import { RouteErrorState } from '@/components/route-error-state';

export default function ProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorState
      title="Profile settings could not load"
      description="Your saved profile is still intact. Retry to load settings again."
      onRetry={reset}
    />
  );
}
