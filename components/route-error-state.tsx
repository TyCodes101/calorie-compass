'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export function RouteErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="app-page app-screen flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="app-section-label">Something went wrong</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            <button
              type="button"
              onClick={onRetry}
              className="app-button-secondary mt-5 inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition hover:border-teal-200 hover:text-teal-700"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
