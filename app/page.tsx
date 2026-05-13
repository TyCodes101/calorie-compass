import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, Flame, Sparkles, Target } from 'lucide-react';

import { DefaultStartScreenRedirect } from '@/components/default-start-screen-redirect';
import { MacroProgress } from '@/components/macro-progress';
import { TrustBadge } from '@/components/trust-badge';
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getDashboardData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

type DashboardPageProps = {
  searchParams?: Promise<{
    saved?: string | string[];
    updated?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const saved = pickFirst(params?.saved);
  const updated = pickFirst(params?.updated);
  const dashboard = await getDashboardData();

  if (!dashboard) {
    redirect('/onboarding');
  }

  return (
    <>
      <DefaultStartScreenRedirect disabled={Boolean(saved || updated)} />
      <div className="app-page app-screen-wide flex min-w-0 flex-col gap-7 py-6 md:gap-8">
        {saved || updated ? (
          <section
            className={`app-card rounded-[26px] px-4 py-3 text-sm ${saved ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800' : 'border-sky-200 bg-sky-50/90 text-sky-800'}`}
          >
            {saved ? 'Meal saved. Today’s totals updated right away.' : 'Meal updated. Your latest totals are reflected here.'}
          </section>
        ) : null}

        <section className="grid min-w-0 gap-6 xl:grid-cols-[1.42fr_0.92fr]">
          <div className="app-card relative min-w-0 overflow-hidden rounded-[36px] p-6 md:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-teal-50 via-sky-50/70 to-white" />
            <div className="pointer-events-none absolute right-[-4rem] top-[-3rem] h-32 w-32 rounded-full bg-teal-100/60 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <p className="app-section-label">Today</p>
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 md:text-[2rem]">Welcome back, {dashboard.user.name}</h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-[0.95rem]">
                    You have logged <span className="font-semibold text-slate-950">{dashboard.totals.calories} calories</span> today and have{' '}
                    <span className="font-semibold text-slate-950">{dashboard.remainingCalories} calories</span> remaining.
                  </p>
                </div>
                <Link
                  href="/logger"
                  className="app-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto"
                >
                  Log a meal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="app-muted-card rounded-[28px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-[18px] bg-amber-50 p-2.5 text-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <Flame className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Calories eaten</span>
                  </div>
                  <p className="mt-4 text-[2rem] font-semibold tracking-[-0.03em] text-slate-950">{dashboard.totals.calories}</p>
                  <p className="mt-2 text-sm text-slate-500">Goal {dashboard.macroGoals.calories}</p>
                </div>

                <div className="app-muted-card rounded-[28px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-[18px] bg-sky-50 p-2.5 text-sky-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <Target className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Remaining</span>
                  </div>
                  <p className="mt-4 text-[2rem] font-semibold tracking-[-0.03em] text-slate-950">{dashboard.remainingCalories}</p>
                  <p className="mt-2 text-sm text-slate-500">Keep meals realistic, not perfect.</p>
                </div>

                <div className="app-muted-card rounded-[28px] p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-[18px] bg-teal-50 p-2.5 text-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Trust summary</span>
                  </div>
                  <p className="mt-4 text-[1.55rem] font-semibold tracking-[-0.03em] text-slate-950">{dashboard.trustSummary.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{dashboard.trustSummary.estimatedSummary}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="app-card relative min-w-0 overflow-hidden rounded-[36px] p-6 md:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white to-transparent" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="app-section-label">Goal progress</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Macros and trust</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">A cleaner read on how today is stacking up, without turning the dashboard into a spreadsheet.</p>
                </div>
                <div className="rounded-full border border-slate-200/80 bg-white/86 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                  {dashboard.trustSummary.headline}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <MacroProgress label="Protein" current={dashboard.totals.protein} goal={dashboard.macroGoals.protein} percent={dashboard.macroProgress.protein} colorClass="bg-teal-500" />
                <MacroProgress label="Carbs" current={dashboard.totals.carbs} goal={dashboard.macroGoals.carbs} percent={dashboard.macroProgress.carbs} colorClass="bg-sky-500" />
                <MacroProgress label="Fat" current={dashboard.totals.fat} goal={dashboard.macroGoals.fat} percent={dashboard.macroProgress.fat} colorClass="bg-amber-400" />
              </div>

              <div className="mt-6 rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/80 p-2 text-emerald-600 shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{dashboard.trustSummary.detail}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{dashboard.disclaimer}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="app-card min-w-0 overflow-hidden rounded-[36px] p-6 md:p-7">
            <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="app-section-label">Weekly trend</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Calorie trend vs goal</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">A softer, easier-to-scan view of how your week is trending.</p>
              </div>
              <Link href="/history" className="text-sm font-medium text-teal-700 transition hover:text-teal-600">
                View history
              </Link>
            </div>
            <div className="rounded-[30px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:p-5">
              <TrendChartPanel data={dashboard.weeklyTrend} />
            </div>
          </div>

          <div className="app-card min-w-0 overflow-hidden rounded-[36px] p-6 md:p-7">
            <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="app-section-label">Recent meals</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Today’s log</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Quick actions stay close so repeat logging feels fast and intentional.</p>
              </div>
              <Link href="/history" className="text-sm font-medium text-teal-700 transition hover:text-teal-600">
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {dashboard.recentMeals.length ? (
                dashboard.recentMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="min-w-0 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_14px_28px_rgba(148,163,184,0.1),inset_0_1px_0_rgba(255,255,255,0.86)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_34px_rgba(148,163,184,0.14),inset_0_1px_0_rgba(255,255,255,0.9)]"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium capitalize text-slate-950">{meal.mealType}</p>
                          <TrustBadge trusted={meal.estimatedCount === 0} compact />
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{meal.rawText || `${meal.itemCount} item meal`}</p>
                        <p className="mt-2 text-xs text-slate-400">{meal.coverageSummary}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-950">{meal.totalCalories} cal</p>
                        <p className="text-xs text-slate-400">{new Date(meal.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Protein {meal.totalProtein}g</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Carbs {meal.totalCarbs}g</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Fat {meal.totalFat}g</span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Link
                        href={`/logger?mealId=${meal.id}`}
                        className="app-button-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium hover:border-teal-200 hover:text-teal-700"
                      >
                        Log again
                      </Link>
                      <Link
                        href={`/logger?editMealId=${meal.id}`}
                        className="app-button-secondary inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium hover:border-teal-200 hover:text-teal-700"
                      >
                        Edit meal
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="app-empty-state rounded-[28px] p-5 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">No meals logged yet today</p>
                  <p className="mt-2 leading-6">Once you log something, today’s calories, trust coverage, and recent meals will show up here right away.</p>
                  <Link
                    href="/logger"
                    className="app-button-secondary mt-4 inline-flex items-center gap-2 px-4 py-2.5 font-medium hover:border-teal-300 hover:text-teal-700"
                  >
                    Log your first meal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
