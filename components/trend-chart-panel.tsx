'use client';

import dynamic from 'next/dynamic';

const TrendChart = dynamic(() => import('@/components/trend-chart').then((mod) => mod.TrendChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />,
});

type TrendPoint = {
  date: string;
  calories: number;
  goal: number;
};

export function TrendChartPanel({ data }: { data: TrendPoint[] }) {
  return <TrendChart data={data} />;
}
