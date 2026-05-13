'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TrendPoint = {
  date: string;
  calories: number;
  goal: number;
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full min-w-0 rounded-[26px] border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 p-3 shadow-[0_14px_28px_rgba(148,163,184,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] md:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="caloriesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => value.slice(5)}
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              borderColor: 'rgba(219,228,239,0.9)',
              borderRadius: 16,
              boxShadow: '0 18px 32px rgba(15,23,42,0.12)',
            }}
          />
          <Area type="monotone" dataKey="calories" stroke="#14b8a6" strokeWidth={3} fill="url(#caloriesFill)" />
          <Area type="monotone" dataKey="goal" stroke="#f59e0b" strokeDasharray="6 6" fillOpacity={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
