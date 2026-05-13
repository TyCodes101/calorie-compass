import { describe, expect, it } from 'vitest';

import { buildWeeklyTrendFromMeals, sumMealTotals } from '@/lib/dashboard-aggregation';

describe('dashboard aggregation', () => {
  it('sums macro totals from meals without writing derived rows', () => {
    expect(
      sumMealTotals([
        {
          totalCalories: 300,
          totalProtein: 20,
          totalCarbs: 30,
          totalFat: 10,
          totalFiber: 4,
          totalSugar: 6,
          totalSodium: 400,
        },
        {
          totalCalories: 450,
          totalProtein: 35,
          totalCarbs: 40,
          totalFat: 15,
          totalFiber: 6,
          totalSugar: 8,
          totalSodium: 500,
        },
      ]),
    ).toEqual({
      calories: 750,
      protein: 55,
      carbs: 70,
      fat: 25,
      fiber: 10,
      sugar: 14,
      sodium: 900,
    });
  });

  it('builds a seven-day trend from meal totals grouped by day', () => {
    const trend = buildWeeklyTrendFromMeals(
      [
        {
          date: new Date('2026-05-11T12:00:00.000Z'),
          totalCalories: 300,
          totalProtein: 20,
          totalCarbs: 30,
          totalFat: 10,
          totalFiber: 4,
          totalSugar: 6,
          totalSodium: 400,
        },
        {
          date: new Date('2026-05-11T18:00:00.000Z'),
          totalCalories: 500,
          totalProtein: 30,
          totalCarbs: 50,
          totalFat: 20,
          totalFiber: 6,
          totalSugar: 8,
          totalSodium: 600,
        },
        {
          date: new Date('2026-05-13T15:00:00.000Z'),
          totalCalories: 650,
          totalProtein: 40,
          totalCarbs: 55,
          totalFat: 22,
          totalFiber: 7,
          totalSugar: 9,
          totalSodium: 700,
        },
      ],
      '2026-05-13T20:00:00.000Z',
      2200,
    );

    expect(trend).toHaveLength(7);
    expect(trend.at(-3)).toEqual({ date: '2026-05-11', calories: 800, goal: 2200 });
    expect(trend.at(-1)).toEqual({ date: '2026-05-13', calories: 650, goal: 2200 });
  });
});
