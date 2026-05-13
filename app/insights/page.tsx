import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowRight, Dumbbell, Flame, Goal, Scale, ShieldCheck, Sparkles, Target, TrendingUp } from 'lucide-react';

import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getInsightsData } from '@/lib/insights';

export const dynamic = 'force-dynamic';

const dailyCards = [
  { key: 'steps', label: 'Steps', icon: Activity },
  { key: 'calories', label: 'Calories eaten', icon: Flame },
  { key: 'burned', label: 'Estimated burned', icon: Target },
  { key: 'net', label: 'Net calories', icon: TrendingUp },
  { key: 'protein', label: 'Protein progress', icon: Dumbbell },
  { key: 'macro', label: 'Macro balance', icon: Goal },
  { key: 'water', label: 'Water intake', icon: Sparkles },
  { key: 'streaks', label: 'Active streaks', icon: ShieldCheck },
] as const;

export default async function InsightsPage() {
  const insights = await getInsightsData();

  if (!insights) {
    redirect('/onboarding');
  }

  const dailyValues = {
    steps: {
      value: `${insights.dailyOverview.steps}`,
      supporting: 'Waiting for step data or a future device connection.',
    },
    calories: {
      value: `${insights.dailyOverview.caloriesEaten}`,
      supporting: 'Nutrition logging stays the core action here.',
    },
    burned: {
      value: `${insights.dailyOverview.estimatedBurnedCalories}`,
      supporting: 'Baseline estimate from your activity setting until movement sync is live.',
    },
    net: {
      value: `${insights.dailyOverview.netCalories}`,
      supporting: 'Net currently uses logged calories minus estimated active burn.',
    },
    protein: {
      value: `${insights.dailyOverview.proteinProgress.current} / ${insights.dailyOverview.proteinProgress.goal}g`,
      supporting: `${insights.dailyOverview.proteinProgress.percent}% of today’s protein target.`,
    },
    macro: {
      value: insights.dailyOverview.macroBalance,
      supporting: 'Quick read on how today’s macros are leaning so far.',
    },
    water: {
      value: `${insights.dailyOverview.waterIntake.current} / ${insights.dailyOverview.waterIntake.goal}`,
      supporting: 'Placeholder until hydration tracking is added.',
    },
    streaks: {
      value: `${insights.dailyOverview.activeStreaks.movementDays} active days`,
      supporting: `${insights.dailyOverview.activeStreaks.trackingDays}-day nutrition logging streak so far.`,
    },
  } as const;

  return (
    <div className="app-page app-screen-wide flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="app-section-label">Insights</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">A lightweight health and movement hub</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Nutrition logging still leads the product. Insights adds calm movement context, weekly patterns, and future-ready scaffolding without turning the app into a noisy fitness dashboard.
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
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="mb-5">
          <p className="app-section-label">Daily overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Today at a glance</h2>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dailyCards.map((card) => {
            const Icon = card.icon;
            const content = dailyValues[card.key];

            return (
              <article key={card.key} className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">{card.label}</p>
                </div>
                <p className="mt-4 break-words text-2xl font-semibold text-slate-950">{content.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{content.supporting}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="app-section-label">Weekly trends</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Calories and consistency</h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
              Nutrition-led, movement-ready
            </div>
          </div>
          <TrendChartPanel data={insights.weeklyTrends.chart} />
        </div>

        <div className="app-card min-w-0 rounded-[32px] p-6">
          <p className="app-section-label">Trend summary</p>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            {[
              ['Calorie consistency', insights.weeklyTrends.calorieConsistency],
              ['Protein consistency', insights.weeklyTrends.proteinConsistency],
              ['Workout frequency', insights.weeklyTrends.workoutFrequency],
              ['Step average', insights.weeklyTrends.stepAverage],
              ['Estimated deficit/surplus', insights.weeklyTrends.estimatedDeficitOrSurplus],
              ['Weight trend', insights.weeklyTrends.weightTrend],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-3 break-words text-lg font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="mb-5">
          <p className="app-section-label">Movement tracking</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Scaffolds for steps, workouts, and burn</h2>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.movementTracking.map((item) => (
            <article key={item.title} className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-950">{item.title}</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{item.metric}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1fr_0.92fr]">
        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="mb-5">
            <p className="app-section-label">AI insight cards</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Calm, useful pattern highlights</h2>
          </div>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {insights.insightCards.map((card) => (
              <article key={card.title} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${card.tone === 'live' ? 'bg-emerald-50 text-emerald-700' : card.tone === 'tip' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                    {card.tone === 'live' ? 'Live' : card.tone === 'tip' ? 'Tip' : 'Preview'}
                  </span>
                </div>
                <p className="mt-4 text-base font-medium leading-6 text-slate-900">{card.detail}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.supporting}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="mb-5">
            <p className="app-section-label">Future integration prep</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ready for Apple Health and Google Fit</h2>
          </div>
          <div className="space-y-3">
            {insights.integrations.map((integration) => (
              <article key={integration.title} className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <Scale className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold">{integration.title}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  {integration.fields.map((field) => (
                    <span key={field} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      {field}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
