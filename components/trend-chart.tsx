'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TrendPoint = {
  date: string;
  calories: number;
  goal: number;
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="caloriesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => value.slice(5)}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#020617',
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 16,
            }}
          />
          <Area type="monotone" dataKey="calories" stroke="#34d399" strokeWidth={3} fill="url(#caloriesFill)" />
          <Area type="monotone" dataKey="goal" stroke="#f59e0b" strokeDasharray="6 6" fillOpacity={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
