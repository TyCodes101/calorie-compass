import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, Flame, ShieldCheck, Sparkles, Target, UtensilsCrossed } from 'lucide-react';

import { TrendChartPanel } from '@/components/trend-chart-panel';
import { getInsightsData } from '@/lib/insights';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const insights = await getInsightsData();

  if (!insights) {
    redirect('/onboarding');
  }

  const dailyCards = [
    {
      label: 'Calories eaten',
      value: `${insights.dailyOverview.caloriesEaten}`,
      supporting: 'Updates from today’s saved meals.',
      icon: Flame,
    },
    {
      label: 'Remaining today',
      value: `${insights.dailyOverview.remainingCalories}`,
      supporting: 'A calmer guide than chasing perfection meal by meal.',
      icon: Target,
    },
    {
      label: 'Protein progress',
      value: `${insights.dailyOverview.proteinProgress.current} / ${insights.dailyOverview.proteinProgress.goal}g`,
      supporting: `${insights.dailyOverview.proteinProgress.percent}% of today’s target.`,
      icon: Sparkles,
    },
    {
      label: 'Meals logged',
      value: `${insights.dailyOverview.mealsLogged}`,
      supporting: insights.dailyOverview.loggingStreak
        ? `${insights.dailyOverview.loggingStreak}-day logging streak.`
        : 'Your streak starts once you log on consecutive days.',
      icon: UtensilsCrossed,
    },
    {
      label: 'Trust coverage',
      value: insights.dailyOverview.trustCoverage.totalCount
        ? `${insights.dailyOverview.trustCoverage.percent}%`
        : 'No meals yet',
      supporting: insights.dailyOverview.trustCoverage.totalCount
        ? insights.dailyOverview.trustCoverage.estimatedSummary
        : 'Once meals are logged, this shows how much matched structured nutrition sources.',
      icon: ShieldCheck,
    },
    {
      label: 'Macro balance',
      value: insights.dailyOverview.macroBalance,
      supporting: 'A simple read on how today is leaning so far.',
      icon: Sparkles,
    },
  ];

  const summaryCards = [
    ['Logging days', insights.weeklyTrends.loggingDays],
    ['Calorie consistency', insights.weeklyTrends.calorieConsistency],
    ['Protein consistency', insights.weeklyTrends.proteinConsistency],
    ['Consistency score', insights.weeklyTrends.consistencyScore],
    ['Calories trend', insights.weeklyTrends.calorieTrend],
    ['Protein trend', insights.weeklyTrends.proteinTrend],
    ['Average calories', insights.weeklyTrends.averageCalories],
    ['Average protein', insights.weeklyTrends.averageProtein],
    ['Repeat pattern', insights.weeklyTrends.topMealType],
  ] as const;

  return (
    <div className="app-page app-screen-wide flex min-w-0 flex-col gap-6 py-6">
      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="app-section-label">Insights</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Calm weekly nutrition patterns</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              A quiet view of the patterns behind your logging, built to support fast, trustworthy nutrition decisions instead of overwhelming you with fitness noise.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <Link
              href="/logger"
              className="app-button-primary inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold transition sm:w-auto"
            >
              Log a meal
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/history" className="text-sm font-medium text-teal-700 hover:text-teal-600">
              Review history
            </Link>
          </div>
        </div>
      </section>

      <section className="app-card min-w-0 rounded-[32px] p-6">
        <div className="mb-5">
          <p className="app-section-label">Today</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Daily signal</h2>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dailyCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">{card.label}</p>
                </div>
                <p className="mt-4 break-words text-2xl font-semibold text-slate-950">{card.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.supporting}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-card min-w-0 rounded-[32px] p-6">
          <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="app-section-label">Weekly trend</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Calories vs goal</h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
              {insights.weeklyTrends.averageMealsPerDay}
            </div>
          </div>
          <TrendChartPanel data={insights.weeklyTrends.chart} />
        </div>

        <div className="app-card min-w-0 rounded-[32px] p-6">
          <p className="app-section-label">Summary</p>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            {summaryCards.map(([label, value]) => (
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
          <p className="app-section-label">Highlights</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pattern notes worth acting on</h2>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {insights.patternCards.map((card) => (
            <article key={card.title} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">{card.title}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${card.tone === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}
                >
                  {card.tone === 'live' ? 'Live' : 'Guide'}
                </span>
              </div>
              <p className="mt-4 text-base font-medium leading-6 text-slate-900">{card.detail}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.supporting}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
