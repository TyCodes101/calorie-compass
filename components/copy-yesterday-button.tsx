'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, LoaderCircle } from 'lucide-react';

import { AppModal } from '@/components/app-modal';

type CopyYesterdayButtonProps = {
  disabled?: boolean;
};

export function CopyYesterdayButton({ disabled }: CopyYesterdayButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openConfirmation() {
    if (disabled || loading) return;
    setMessage(null);
    setConfirmOpen(true);
  }

  async function handleCopy() {
    if (disabled || loading) return;
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
      setConfirmOpen(false);
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
        onClick={openConfirmation}
        disabled={disabled || loading}
        className="app-button-secondary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        Copy yesterday
      </button>
      {message ? <p className="text-xs leading-5 text-slate-500">{message}</p> : null}
      <AppModal
        open={confirmOpen}
        title="Copy yesterday"
        description="Review this repeat action before it changes today. MacroMesh will copy yesterday's saved meals only if today is still empty."
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        footer={
          <>
            <button type="button" onClick={() => setConfirmOpen(false)} disabled={loading} className="app-button-secondary px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70">
              Cancel
            </button>
            <button type="button" onClick={handleCopy} disabled={loading} className="app-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70">
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              {loading ? 'Copying...' : 'Copy meals'}
            </button>
          </>
        }
      >
        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p className="font-medium text-slate-900">Nothing saves until the copied meals are created for review.</p>
          <p className="mt-2">If you already logged today, the copy is blocked so your current day stays intact.</p>
        </div>
      </AppModal>
    </div>
  );
}

