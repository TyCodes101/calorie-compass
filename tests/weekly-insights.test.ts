import { describe, expect, it } from 'vitest';

import { buildWeeklyInsights } from '@/lib/weekly-insights';

describe('weekly insights', () => {
  it('computes averages and best days from logged meals', () => {
    const insights = buildWeeklyInsights({
      currentDate: '2026-06-09T00:00:00.000Z',
      meals: [
        { date: '2026-06-09T02:00:00.000Z', totalCalories: 2000, totalProtein: 160 },
        { date: '2026-06-08T02:00:00.000Z', totalCalories: 2400, totalProtein: 180 },
        { date: '2026-06-08T04:00:00.000Z', totalCalories: 200, totalProtein: 10 },
      ],
    });

    expect(insights.daysLogged).toBe(2);
    expect(insights.averageCalories).toBe(Math.round((2000 + 2600) / 2));
    expect(insights.bestProteinDay?.protein).toBe(190);
    expect(insights.highestCalorieDay?.calories).toBe(2600);
  });
});

