'use client';

import dynamic from 'next/dynamic';

const TrendChart = dynamic(() => import('@/components/trend-chart').then((mod) => mod.TrendChart), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-[24px] border border-slate-200 bg-white" />,
});

type TrendPoint = {
  date: string;
  calories: number;
  goal: number;
};

export function TrendChartPanel({ data }: { data: TrendPoint[] }) {
  return <TrendChart data={data} />;
}
