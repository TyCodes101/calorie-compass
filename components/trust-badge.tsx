'use client';

import clsx from 'clsx';

type TrustBadgeTone = 'verified' | 'branded' | 'generic' | 'estimated';

export function TrustBadge({
  trusted,
  compact = false,
  label,
  tone,
}: {
  trusted: boolean;
  compact?: boolean;
  label?: string;
  tone?: TrustBadgeTone;
}) {
  const resolvedTone = tone ?? (trusted ? 'verified' : 'estimated');

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        resolvedTone === 'verified' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        resolvedTone === 'branded' && 'border-sky-200 bg-sky-50 text-sky-700',
        resolvedTone === 'generic' && 'border-slate-200 bg-slate-50 text-slate-700',
        resolvedTone === 'estimated' && 'border-amber-200 bg-amber-50 text-amber-700',
        compact && 'px-2 py-0.5 text-[10px]'
      )}
    >
      {label ?? (trusted ? 'Verified' : 'Estimated')}
    </span>
  );
}
