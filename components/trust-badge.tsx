'use client';

import clsx from 'clsx';

export function TrustBadge({ trusted, compact = false }: { trusted: boolean; compact?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        trusted
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700',
        compact && 'px-2 py-0.5 text-[10px]'
      )}
    >
      {trusted ? 'Verified' : 'Estimated'}
    </span>
  );
}

