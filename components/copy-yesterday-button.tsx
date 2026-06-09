'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, LoaderCircle } from 'lucide-react';

type CopyYesterdayButtonProps = {
  disabled?: boolean;
};

export function CopyYesterdayButton({ disabled }: CopyYesterdayButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCopy() {
    if (disabled || loading) return;
    const confirmed = window.confirm('Copy yesterday’s meals into today? This won’t run if you already logged today.');
    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/meals/copy-yesterday', { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(data?.reason === 'localOnly' ? 'Copy Yesterday needs a live backend for now.' : 'We couldn’t copy yesterday right now.');
        setLoading(false);
        return;
      }

      if (!data?.copied) {
        setMessage(
          data?.reason === 'empty'
            ? 'No meals to copy from yesterday.'
            : data?.reason === 'alreadyHasMeals'
              ? 'Yesterday’s meals already copied (or you already logged today).'
              : 'Nothing copied.',
        );
        setLoading(false);
        return;
      }

      setMessage(`Copied ${data.mealCount} meal${data.mealCount === 1 ? '' : 's'} from yesterday.`);
      router.refresh();
      setLoading(false);
    } catch {
      setMessage('We couldn’t copy yesterday right now.');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled || loading}
        className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Copy yesterday
      </button>
      {message ? <p className="text-xs leading-5 text-slate-500">{message}</p> : null}
    </div>
  );
}

