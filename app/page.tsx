import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';

import { DefaultStartScreenRedirect } from '@/components/default-start-screen-redirect';
import { MacroProgress } from '@/components/macro-progress';
import { TrustBadge } from '@/components/trust-badge';
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getDashboardData } from '@/lib/dashboard';
import { CopyYesterdayButton } from '@/components/copy-yesterday-button';

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
      <div className="app-page app-screen-wide flex min-w-0 flex-col gap-6 py-6 md:gap-7">
        {saved || updated ? (
          <section
            className={`app-card rounded-[24px] px-4 py-3 text-sm ${saved ? 'border-emerald-200 bg-emerald-50/92 text-emerald-800' : 'border-sky-200 bg-sky-50/92 text-sky-800'}`}
          >
            {saved ? 'Saved, and today’s totals are already updated.' : 'Updated, and the latest totals are already reflected here.'}
          </section>
        ) : null}

        <section className="app-card relative overflow-hidden rounded-[34px] p-6 md:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-teal-50/90 to-transparent" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <p className="app-section-label">Today</p>
                <h2 className="text-[1.85rem] font-semibold tracking-[-0.03em] text-slate-950 md:text-[2rem]">Welcome back, {dashboard.user.name}</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-slate-950">{dashboard.dailySummary.title}.</span> {dashboard.dailySummary.description}
                </p>
              </div>
              <Link href="/logger" className="app-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold sm:w-auto">
                Log a meal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <CopyYesterdayButton disabled={dashboard.mealCount > 0} />
              <Link href="/logger" className="app-button-secondary inline-flex items-center justify-center px-4 py-2 text-sm font-medium hover:border-teal-200 hover:text-teal-700">
                Open logger
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Calories', value: `${dashboard.totals.calories}`, detail: `Goal ${dashboard.macroGoals.calories}` },
                {
                  label: dashboard.remainingCalories >= 0 ? 'Remaining' : 'Over target',
                  value: dashboard.remainingCalories >= 0 ? `${dashboard.remainingCalories}` : `+${Math.abs(dashboard.remainingCalories)}`,
                  detail: dashboard.remainingCalories >= 0 ? 'Still available today' : 'Useful data, not a reset',
                },
                { label: 'Meals logged', value: `${dashboard.mealCount}`, detail: 'Logged today' },
                { label: 'Trust', value: dashboard.trustSummary.headline, detail: dashboard.trustSummary.totalCount ? dashboard.trustSummary.estimatedSummary : 'Sources appear after your first meal' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[22px] border border-slate-200/80 bg-slate-50/78 px-4 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{stat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        <section className="grid min-w-0 gap-3 md:grid-cols-3" aria-label="Product strengths">
          {[
            {
              title: 'Conversational logging',
              text: 'Type meals the way you remember them. The assistant turns messy food notes into reviewable items.',
              icon: MessageSquareText,
            },
            {
              title: 'Review before save',
              text: 'Every meal gets a totals card first, so corrections and portion edits happen before the dashboard changes.',
              icon: Sparkles,
            },
            {
              title: 'Source-aware nutrition',
              text: 'Verified restaurant, USDA, and structured matches are labeled separately from estimates.',
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="app-card min-w-0 rounded-[26px] p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-teal-50 p-2 text-teal-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="app-card min-w-0 rounded-[32px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="app-section-label">Today’s progress</p>
                <h3 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-slate-950">Macros</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">A clean read on today’s macro targets.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3.5">
              <MacroProgress
                label="Protein"
                current={dashboard.totals.protein}
                goal={dashboard.macroGoals.protein}
                percent={dashboard.macroProgress.protein}
                colorClass="bg-teal-500"
                trackClass="bg-teal-100/85"
                pillClass="border-teal-100 bg-teal-50 text-teal-700"
              />
              <MacroProgress
                label="Carbs"
                current={dashboard.totals.carbs}
                goal={dashboard.macroGoals.carbs}
                percent={dashboard.macroProgress.carbs}
                colorClass="bg-sky-500"
                trackClass="bg-sky-100/85"
                pillClass="border-sky-100 bg-sky-50 text-sky-700"
              />
              <MacroProgress
                label="Fat"
                current={dashboard.totals.fat}
                goal={dashboard.macroGoals.fat}
                percent={dashboard.macroProgress.fat}
                colorClass="bg-amber-400"
                trackClass="bg-amber-100/90"
                pillClass="border-amber-100 bg-amber-50 text-amber-700"
              />
            </div>
          </div>

          <div className="app-card min-w-0 rounded-[32px] p-6 md:p-7">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div>
                <p className="app-section-label">Consistency</p>
                <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-950">Streak & weekly insights</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Small wins, tracked quietly.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Current streak</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{dashboard.streaks.currentStreakDays} days</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Longest: {dashboard.streaks.longestStreakDays} days</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">This week</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{dashboard.weeklyInsights.daysLogged} / 7 days logged</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Avg {dashboard.weeklyInsights.averageCalories} cal, {dashboard.weeklyInsights.averageProtein}g protein</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Best protein day</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {dashboard.weeklyInsights.bestProteinDay ? `${dashboard.weeklyInsights.bestProteinDay.protein}g` : '—'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{dashboard.weeklyInsights.bestProteinDay?.date ?? 'Log a day to unlock'}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Highest calorie day</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {dashboard.weeklyInsights.highestCalorieDay ? `${dashboard.weeklyInsights.highestCalorieDay.calories} cal` : '—'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{dashboard.weeklyInsights.highestCalorieDay?.date ?? 'Log a day to unlock'}</p>
              </div>
            </div>
          </div>

          <div className="app-card min-w-0 rounded-[32px] p-6 md:p-7">
            <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
              <div>
                <p className="app-section-label">Recent meals</p>
                <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-950">Today’s log</h3>
              </div>
              <Link href="/history" className="text-sm font-medium text-teal-700 transition hover:text-teal-600">
                View all
              </Link>
            </div>

            <div className="space-y-3">
              {dashboard.recentMeals.length ? (
                dashboard.recentMeals.map((meal) => (
                  <div key={meal.id} className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium capitalize text-slate-950">{meal.mealType}</p>
                          <TrustBadge trusted={meal.estimatedCount === 0} compact />
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{meal.rawText || `${meal.itemCount} item meal`}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-950">{meal.totalCalories} cal</p>
                        <p className="mt-1 text-[11px] text-slate-400">{new Date(meal.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">P {meal.totalProtein}g</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">C {meal.totalCarbs}g</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">F {meal.totalFat}g</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{meal.coverageSummary}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/logger?mealId=${meal.id}`} className="app-button-secondary inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium hover:border-teal-200 hover:text-teal-700">
                        Log again
                      </Link>
                      <Link href={`/logger?editMealId=${meal.id}`} className="app-button-secondary inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium hover:border-teal-200 hover:text-teal-700">
                        Edit
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="app-empty-state rounded-[24px] p-5 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Nothing logged yet today</p>
                  <p className="mt-2 leading-6">Start with one plain-language message — “half a Chipotle bowl,” “Fairlife shake,” or “swap fries for apple slices.” You’ll review calories, macros, source coverage, and assumptions before anything saves.</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Restaurants</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Branded foods</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Corrections</span>
                  </div>
                  <Link href="/logger" className="app-button-secondary mt-4 inline-flex items-center gap-2 px-4 py-2.5 font-medium hover:border-teal-300 hover:text-teal-700">
                    Log your first meal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="app-card min-w-0 rounded-[32px] p-6 md:p-7">
          <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="app-section-label">Weekly trend</p>
              <h3 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-950">Calorie trend vs goal</h3>
            </div>
            <Link href="/history" className="text-sm font-medium text-teal-700 transition hover:text-teal-600">
              View history
            </Link>
          </div>
          <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/82 p-4 md:p-5">
            <TrendChartPanel data={dashboard.weeklyTrend} />
          </div>
        </section>
      </div>
    </>
  );
}
