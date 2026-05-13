'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Clock3, Star, Trash2, WifiOff } from 'lucide-react';

import { TrustBadge } from '@/components/trust-badge';
import type { MealHistoryGroup } from '@/lib/history';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';
import { useOnlineStatus } from '@/lib/use-online-status';

type Notice = {
  tone: 'success' | 'error';
  text: string;
};

type ConfirmState =
  | {
      kind: 'meal';
      id: string;
      title: string;
    }
  | {
      kind: 'favorite';
      id: string;
      title: string;
    }
  | null;

function flattenMealCount(history: MealHistoryGroup[]) {
  return history.reduce((count, group) => count + group.meals.length, 0);
}

function removeMealFromHistory(history: MealHistoryGroup[], mealId: string) {
  return history
    .map((group) => ({
      ...group,
      meals: group.meals.filter((meal) => meal.id !== mealId),
    }))
    .filter((group) => group.meals.length > 0);
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <section
      className={`rounded-[24px] border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
      role="status"
    >
      {notice.text}
    </section>
  );
}

function ConfirmDialog({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!state) {
    return null;
  }

  const isMeal = state.kind === 'meal';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_28px_60px_rgba(15,23,42,0.2)]">
        <p className="app-section-label">Confirm</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{isMeal ? 'Delete this meal?' : 'Remove this favorite?'}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {isMeal
            ? `“${state.title}” will be removed from your history. This updates your saved totals for that day.`
            : `“${state.title}” will be removed from your favorites, but any past logged meals will stay in history.`}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onCancel} disabled={loading} className="app-button-secondary px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center justify-center rounded-[18px] border border-rose-200 bg-rose-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Working...' : isMeal ? 'Delete meal' : 'Remove favorite'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function HistoryClient({
  initialHistory,
  initialFavorites,
  initialNotice,
}: {
  initialHistory: MealHistoryGroup[];
  initialFavorites: FavoriteMealSummary[];
  initialNotice: Notice | null;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [notice, setNotice] = useState<Notice | null>(initialNotice);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isOnline = useOnlineStatus();

  const totalMeals = useMemo(() => flattenMealCount(history), [history]);
  const hasHistory = totalMeals > 0;

  async function handleConfirm() {
    if (!confirmState || actionLoading) {
      return;
    }

    if (!isOnline) {
      setNotice({ tone: 'error', text: 'You appear to be offline. Reconnect to delete or remove items.' });
      return;
    }

    setActionLoading(true);

    try {
      if (confirmState.kind === 'meal') {
        const response = await fetch(`/api/meals/${confirmState.id}`, { method: 'DELETE' });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? 'We couldn’t delete that meal right now. Please try again.');
        }

        setHistory((current) => removeMealFromHistory(current, confirmState.id));
        setNotice({ tone: 'success', text: 'Meal deleted. Your saved history is up to date.' });
      } else {
        const response = await fetch(`/api/reusable-meals/${confirmState.id}`, { method: 'DELETE' });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? 'We couldn’t remove that favorite right now. Please try again.');
        }

        setFavorites((current) => current.filter((favorite) => favorite.id !== confirmState.id));
        setNotice({ tone: 'success', text: 'Favorite removed.' });
      }

      setConfirmState(null);
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <>
      <div className="app-page app-screen flex min-w-0 flex-col gap-6 py-6">
        {!isOnline ? (
          <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <WifiOff className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium text-slate-900">You are offline right now.</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">History is still visible, but edit, delete, and favorite changes need a connection.</p>
              </div>
            </div>
          </section>
        ) : null}
        {notice ? <NoticeBanner notice={notice} /> : null}

        <section className="app-card min-w-0 rounded-[32px] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-section-label">History</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Your meal timeline</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Scroll recent meals, relog fast, edit saved entries cleanly, and keep a calm view of what you actually ate.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
              {favorites.length} favorites, {totalMeals} logged meals
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
                <article key={favorite.id} className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{favorite.title}</p>
                      <p className="mt-1 text-sm capitalize text-slate-500">{favorite.mealType}</p>
                      <p className="mt-2 text-xs text-slate-400">{favorite.lastUsedAt ? `Last used ${new Date(favorite.lastUsedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Ready for quick repeat logging'}</p>
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
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/logger?favorite=${favorite.id}`}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                    >
                      Use favorite
                    </Link>
                    <button
                      type="button"
                      disabled={!isOnline}
                      onClick={() => setConfirmState({ kind: 'favorite', id: favorite.id, title: favorite.title })}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="app-empty-state min-w-0 rounded-[28px] p-6 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">No favorites yet</p>
            <p className="mt-2 leading-6">Save a meal as a favorite from the review screen and it will show up here for one-tap repeat logging.</p>
          </section>
        )}

        {!hasHistory ? (
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
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-4 w-4" />
                      {meal.trustedCount} verified, {meal.estimatedCount} estimated
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Link href={`/logger?editMealId=${meal.id}`} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
                        Edit meal
                      </Link>
                      <Link href={`/logger?mealId=${meal.id}`} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-teal-200 hover:text-teal-700">
                        Log again
                      </Link>
                      <button
                        type="button"
                        disabled={!isOnline}
                        onClick={() => setConfirmState({ kind: 'meal', id: meal.id, title: meal.title })}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <ConfirmDialog state={confirmState} loading={actionLoading} onCancel={() => setConfirmState(null)} onConfirm={handleConfirm} />
    </>
  );
}
