import Link from 'next/link';
import { Clock3, Search } from 'lucide-react';

import { TrustBadge } from '@/components/trust-badge';
import { getMealHistory } from '@/lib/history';

export default async function HistoryPage() {
  const history = await getMealHistory();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="app-card rounded-[32px] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="app-section-label">History</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Your meal timeline</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Scroll recent meals, relog favorites fast, and keep a calm view of what you actually ate.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Filters later
          </div>
        </div>
      </section>

      {history.map((group) => (
        <section key={group.date} className="space-y-3">
          <div className="sticky top-0 z-10 -mx-2 rounded-2xl bg-[rgba(247,249,252,0.96)] px-2 py-2 backdrop-blur">
            <p className="text-sm font-semibold text-slate-700">{new Date(group.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="space-y-3">
            {group.meals.map((meal) => (
              <article key={meal.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold capitalize text-slate-950">{meal.mealType}</p>
                      <TrustBadge trusted={meal.estimatedCount === 0} compact />
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">{meal.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Protein {meal.totalProtein}g</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Carbs {meal.totalCarbs}g</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Fat {meal.totalFat}g</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-950">{meal.totalCalories} cal</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(meal.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {meal.trustedCount} verified, {meal.estimatedCount} estimated
                  </div>
                  <Link href="/logger" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
                    Log again
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

