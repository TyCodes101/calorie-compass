import { describe, expect, it } from 'vitest';
import { ActivityLevel } from '@prisma/client';

import { buildInsightsViewModel } from '@/lib/insights';

describe('insights view model', () => {
  it('builds daily overview, weekly trends, and insight cards from meal history', () => {
    const insights = buildInsightsViewModel({
      currentDate: '2026-05-13T00:00:00.000Z',
      profile: {
        dailyCalorieGoal: 2300,
        proteinGoal: 180,
        activityLevel: ActivityLevel.MODERATE,
      },
      todayMeals: [
        {
          date: new Date('2026-05-13T00:00:00.000Z'),
          totalCalories: 900,
          totalProtein: 85,
          totalCarbs: 80,
          totalFat: 30,
        },
      ],
      weeklyMeals: [
        {
          date: new Date('2026-05-09T00:00:00.000Z'),
          totalCalories: 2100,
          totalProtein: 150,
          totalCarbs: 210,
          totalFat: 70,
        },
        {
          date: new Date('2026-05-10T00:00:00.000Z'),
          totalCalories: 1900,
          totalProtein: 120,
          totalCarbs: 180,
          totalFat: 60,
        },
        {
          date: new Date('2026-05-12T00:00:00.000Z'),
          totalCalories: 2250,
          totalProtein: 170,
          totalCarbs: 215,
          totalFat: 65,
        },
        {
          date: new Date('2026-05-13T00:00:00.000Z'),
          totalCalories: 900,
          totalProtein: 85,
          totalCarbs: 80,
          totalFat: 30,
        },
      ],
      weightEntries: [
        { date: new Date('2026-05-13T00:00:00.000Z'), weightLbs: 182 },
        { date: new Date('2026-05-06T00:00:00.000Z'), weightLbs: 183.2 },
      ],
    });

    expect(insights.dailyOverview.caloriesEaten).toBe(900);
    expect(insights.dailyOverview.estimatedBurnedCalories).toBe(260);
    expect(insights.dailyOverview.netCalories).toBe(640);
    expect(insights.dailyOverview.proteinProgress.percent).toBe(47);
    expect(insights.dailyOverview.activeStreaks.trackingDays).toBe(2);
    expect(insights.weeklyTrends.calorieConsistency).toBe('2 of 7 days near target');
    expect(insights.weeklyTrends.proteinConsistency).toBe('1 of 7 days near protein target');
    expect(insights.weeklyTrends.weightTrend).toBe('182 lb (-1.2 lb)');
    expect(insights.movementTracking).toHaveLength(5);
    expect(insights.insightCards).toHaveLength(4);
    expect(insights.insightCards[2]?.detail).toMatch(/You hit your calorie target 2 of the last 7 days/i);
  });
});
