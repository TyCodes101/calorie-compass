import Link from 'next/link';
import { Clock3, Search, Star } from 'lucide-react';

import { TrustBadge } from '@/components/trust-badge';
import { getMealHistory } from '@/lib/history';
import { getFavoriteMeals } from '@/lib/reusable-meals';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const [history, favorites] = await Promise.all([getMealHistory(), getFavoriteMeals()]);
  const hasHistory = history.some((group) => group.meals.length > 0);

  return (
    <div className="app-page app-screen flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="app-section-label">History</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Your meal timeline</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Scroll recent meals, relog favorites fast, and keep a calm view of what you actually ate.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Filters later
          </div>
        </div>
      </section>

      {favorites.length ? (
        <section className="app-card min-w-0 rounded-[32px] p-6">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            <div>
              <p className="app-section-label">Favorites</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Quick repeat meals</h2>
            </div>
          </div>
          <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2">
            {favorites.map((favorite) => (
              <Link
                key={favorite.id}
                href={`/logger?favorite=${favorite.id}`}
                className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm transition hover:border-teal-200 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{favorite.title}</p>
                    <p className="mt-1 text-sm capitalize text-slate-500">{favorite.mealType}</p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    Favorite
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{favorite.totalCalories} cal</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{favorite.itemCount} items</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">{favorite.trustedCount} verified</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {!favorites.length && !hasHistory ? (
        <section className="app-empty-state min-w-0 rounded-[28px] p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">No meals saved yet</p>
          <p className="mt-2 leading-6">This is where your recent meals, favorites, and quick repeat options will show up once you log a few meals.</p>
          <Link href="/logger" className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 font-medium text-teal-700 transition hover:border-teal-300 hover:text-teal-600">
            Log a meal
          </Link>
        </section>
      ) : null}

      {history.map((group) => (
        <section key={group.date} className="min-w-0 space-y-3">
          <div className="sticky top-0 z-10 -mx-2 rounded-2xl bg-[rgba(247,249,252,0.96)] px-2 py-2 backdrop-blur">
            <p className="text-sm font-semibold text-slate-700">{new Date(group.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="space-y-3">
            {group.meals.map((meal) => (
              <article key={meal.id} className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold text-slate-950">{meal.totalCalories} cal</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(meal.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock3 className="h-4 w-4" />
                    {meal.trustedCount} verified, {meal.estimatedCount} estimated
                  </div>
                  <Link href={`/logger?mealId=${meal.id}`} className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700 sm:w-auto">
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
