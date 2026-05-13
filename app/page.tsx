import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Flame, Sparkles, Target } from 'lucide-react';

import { MacroProgress } from '@/components/macro-progress';
import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getDashboardData } from '@/lib/dashboard';

export default async function DashboardPage() {
  const dashboard = await getDashboardData();

  if (!dashboard) {
    redirect('/onboarding');
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Today</p>
              <h2 className="text-3xl font-semibold text-white">Welcome back, {dashboard.user.name}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                You have logged <span className="font-semibold text-white">{dashboard.totals.calories} calories</span> today and have <span className="font-semibold text-white">{dashboard.remainingCalories} calories</span> remaining.
              </p>
            </div>
            <Link
              href="/logger"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Log a meal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
              <div className="flex items-center gap-3 text-amber-300"><Flame className="h-5 w-5" /><span className="text-sm font-medium">Calories eaten</span></div>
              <p className="mt-4 text-4xl font-semibold text-white">{dashboard.totals.calories}</p>
              <p className="mt-2 text-sm text-slate-400">Goal {dashboard.macroGoals.calories}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
              <div className="flex items-center gap-3 text-sky-300"><Target className="h-5 w-5" /><span className="text-sm font-medium">Remaining</span></div>
              <p className="mt-4 text-4xl font-semibold text-white">{dashboard.remainingCalories}</p>
              <p className="mt-2 text-sm text-slate-400">Keep meals realistic, not perfect.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
              <div className="flex items-center gap-3 text-emerald-300"><Sparkles className="h-5 w-5" /><span className="text-sm font-medium">AI logging</span></div>
              <p className="mt-4 text-2xl font-semibold text-white">{dashboard.recentMeals.length} meals today</p>
              <p className="mt-2 text-sm text-slate-400">Confirmation-first flow keeps estimates trustworthy.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-sky-300">Goal progress</p>
          <div className="mt-5 space-y-4">
            <MacroProgress label="Protein" current={dashboard.totals.protein} goal={dashboard.macroGoals.protein} percent={dashboard.macroProgress.protein} colorClass="bg-emerald-400" />
            <MacroProgress label="Carbs" current={dashboard.totals.carbs} goal={dashboard.macroGoals.carbs} percent={dashboard.macroProgress.carbs} colorClass="bg-sky-400" />
            <MacroProgress label="Fat" current={dashboard.totals.fat} goal={dashboard.macroGoals.fat} percent={dashboard.macroProgress.fat} colorClass="bg-amber-400" />
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-400">{dashboard.disclaimer}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Weekly trend</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Calorie trend vs goal</h3>
            </div>
          </div>
          <TrendChartPanel data={dashboard.weeklyTrend} />
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-emerald-950/10 backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Recent meals</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Today’s log</h3>
            </div>
            <Link href="/onboarding" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
              Edit goals
            </Link>
          </div>

          <div className="space-y-3">
            {dashboard.recentMeals.map((meal) => (
              <div key={meal.id} className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium capitalize text-white">{meal.mealType}</p>
                    <p className="mt-1 text-sm text-slate-400">{meal.rawText || `${meal.itemCount} item meal`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">{meal.totalCalories} cal</p>
                    <p className="text-xs text-slate-400">{Math.round((meal.confidenceScore ?? 0) * 100)}% confidence</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 px-3 py-1">Protein {meal.totalProtein}g</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">Carbs {meal.totalCarbs}g</span>
                  <span className="rounded-full border border-white/10 px-3 py-1">Fat {meal.totalFat}g</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
