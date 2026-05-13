import { describe, expect, it } from 'vitest';
import { ActivityLevel } from '@prisma/client';

import { buildInsightsViewModel } from '@/lib/insights';

describe('insights view model', () => {
  it('builds daily and weekly nutrition patterns from recent meal history', () => {
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
          mealType: 'LUNCH',
          totalCalories: 900,
          totalProtein: 85,
          totalCarbs: 80,
          totalFat: 30,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          items: [
            { nutritionSourceType: 'GENERIC_REFERENCE' },
            { nutritionSourceType: 'AI_ESTIMATE' },
          ],
        },
      ],
      weeklyMeals: [
        {
          date: new Date('2026-05-09T00:00:00.000Z'),
          mealType: 'BREAKFAST',
          totalCalories: 2100,
          totalProtein: 150,
          totalCarbs: 210,
          totalFat: 70,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          items: [{ nutritionSourceType: 'GENERIC_REFERENCE' }],
        },
        {
          date: new Date('2026-05-10T00:00:00.000Z'),
          mealType: 'DINNER',
          totalCalories: 1900,
          totalProtein: 120,
          totalCarbs: 180,
          totalFat: 60,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          items: [{ nutritionSourceType: 'AI_ESTIMATE' }],
        },
        {
          date: new Date('2026-05-12T00:00:00.000Z'),
          mealType: 'LUNCH',
          totalCalories: 2250,
          totalProtein: 170,
          totalCarbs: 215,
          totalFat: 65,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          items: [{ nutritionSourceType: 'GENERIC_REFERENCE' }],
        },
        {
          date: new Date('2026-05-13T00:00:00.000Z'),
          mealType: 'LUNCH',
          totalCalories: 900,
          totalProtein: 85,
          totalCarbs: 80,
          totalFat: 30,
          totalFiber: 0,
          totalSugar: 0,
          totalSodium: 0,
          items: [
            { nutritionSourceType: 'GENERIC_REFERENCE' },
            { nutritionSourceType: 'AI_ESTIMATE' },
          ],
        },
      ],
    });

    expect(insights.dailyOverview.caloriesEaten).toBe(900);
    expect(insights.dailyOverview.remainingCalories).toBe(1400);
    expect(insights.dailyOverview.proteinProgress.percent).toBe(47);
    expect(insights.dailyOverview.trustCoverage.percent).toBe(50);
    expect(insights.dailyOverview.macroBalance).toMatch(/protein-forward|balanced|carb-heavy|fat-heavy/i);
    expect(insights.weeklyTrends.loggingDays).toBe('4 of 7 days logged');
    expect(insights.weeklyTrends.calorieConsistency).toBe('2 of 7 days near target');
    expect(insights.weeklyTrends.proteinConsistency).toBe('1 of 7 days near protein target');
    expect(insights.weeklyTrends.averageCalories).toBe('1788 avg calories');
    expect(insights.weeklyTrends.averageProtein).toBe('131g avg protein');
    expect(insights.weeklyTrends.topMealType).toBe('lunch is your most-logged meal');
    expect(insights.patternCards).toHaveLength(4);
    expect(insights.patternCards[2]?.detail).toMatch(/trusted sources/i);
  });
});
