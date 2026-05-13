'use client';

import dynamic from 'next/dynamic';

const TrendChart = dynamic(() => import('@/components/trend-chart').then((mod) => mod.TrendChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-3xl border border-white/10 bg-slate-950/30" />,
});

type TrendPoint = {
  date: string;
  calories: number;
  goal: number;
};

export function TrendChartPanel({ data }: { data: TrendPoint[] }) {
  return <TrendChart data={data} />;
}
