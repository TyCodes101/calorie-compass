import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, Flame, Sparkles, Target } from 'lucide-react';

import { MacroProgress } from '@/components/macro-progress';
import { TrustBadge } from '@/components/trust-badge';
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getDashboardData } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const dashboard = await getDashboardData();

  if (!dashboard) {
    redirect('/onboarding');
  }

  return (
    <div className="app-page mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="app-card rounded-[32px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <p className="app-section-label">Today</p>
              <h2 className="text-3xl font-semibold text-slate-950">Welcome back, {dashboard.user.name}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                You have logged <span className="font-semibold text-slate-950">{dashboard.totals.calories} calories</span> today and have <span className="font-semibold text-slate-950">{dashboard.remainingCalories} calories</span> remaining.
              </p>
            </div>
            <Link
              href="/logger"
              className="app-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition sm:w-auto"
            >
              Log a meal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="app-muted-card rounded-[28px] p-5">
              <div className="flex items-center gap-3 text-amber-500"><Flame className="h-5 w-5" /><span className="text-sm font-medium">Calories eaten</span></div>
              <p className="mt-4 text-4xl font-semibold text-slate-950">{dashboard.totals.calories}</p>
              <p className="mt-2 text-sm text-slate-500">Goal {dashboard.macroGoals.calories}</p>
            </div>
            <div className="app-muted-card rounded-[28px] p-5">
              <div className="flex items-center gap-3 text-sky-500"><Target className="h-5 w-5" /><span className="text-sm font-medium">Remaining</span></div>
              <p className="mt-4 text-4xl font-semibold text-slate-950">{dashboard.remainingCalories}</p>
              <p className="mt-2 text-sm text-slate-500">Keep meals realistic, not perfect.</p>
            </div>
            <div className="app-muted-card rounded-[28px] p-5">
              <div className="flex items-center gap-3 text-teal-600"><Sparkles className="h-5 w-5" /><span className="text-sm font-medium">Trust summary</span></div>
              <p className="mt-4 text-2xl font-semibold text-slate-950">{dashboard.trustSummary.headline}</p>
              <p className="mt-2 text-sm text-slate-500">{dashboard.trustSummary.estimatedSummary}</p>
            </div>
          </div>
        </div>

        <div className="app-card rounded-[32px] p-6">
          <p className="app-section-label">Goal progress</p>
          <div className="mt-5 space-y-4">
            <MacroProgress label="Protein" current={dashboard.totals.protein} goal={dashboard.macroGoals.protein} percent={dashboard.macroProgress.protein} colorClass="bg-teal-500" />
            <MacroProgress label="Carbs" current={dashboard.totals.carbs} goal={dashboard.macroGoals.carbs} percent={dashboard.macroProgress.carbs} colorClass="bg-sky-500" />
            <MacroProgress label="Fat" current={dashboard.totals.fat} goal={dashboard.macroGoals.fat} percent={dashboard.macroProgress.fat} colorClass="bg-amber-400" />
          </div>
          <div className="mt-5 rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-medium text-slate-900">{dashboard.trustSummary.detail}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{dashboard.disclaimer}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="app-card rounded-[32px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="app-section-label">Weekly trend</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Calorie trend vs goal</h3>
            </div>
            <Link href="/history" className="text-sm font-medium text-teal-700 hover:text-teal-600">View history</Link>
          </div>
          <TrendChartPanel data={dashboard.weeklyTrend} />
        </div>

        <div className="app-card rounded-[32px] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="app-section-label">Recent meals</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Today’s log</h3>
            </div>
            <Link href="/history" className="text-sm font-medium text-teal-700 hover:text-teal-600">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {dashboard.recentMeals.length ? (
              dashboard.recentMeals.map((meal) => (
                <div key={meal.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium capitalize text-slate-950">{meal.mealType}</p>
                        <TrustBadge trusted={meal.estimatedCount === 0} compact />
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{meal.rawText || `${meal.itemCount} item meal`}</p>
                      <p className="mt-2 text-xs text-slate-400">{meal.coverageSummary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-950">{meal.totalCalories} cal</p>
                      <p className="text-xs text-slate-400">{new Date(meal.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Protein {meal.totalProtein}g</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Carbs {meal.totalCarbs}g</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Fat {meal.totalFat}g</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="app-empty-state rounded-[24px] p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">No meals logged yet today</p>
                <p className="mt-2 leading-6">Once you log something, today’s calories, trust coverage, and recent meals will show up here right away.</p>
                <Link href="/logger" className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 font-medium text-teal-700 transition hover:border-teal-300 hover:text-teal-600">
                  Log your first meal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
