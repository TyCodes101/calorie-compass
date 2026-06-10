import { describe, expect, it } from 'vitest';

import {
  buildDashboardStreaks,
  buildStreakMilestone,
  buildNutritionAnalytics,
  calculateGoalTargets,
  summarizeWeightTrend,
} from '@/lib/growth-metrics';

describe('growth metrics helpers', () => {
  const meals = [
    { date: new Date('2026-06-02T12:00:00.000Z'), totalCalories: 900, totalProtein: 95, totalCarbs: 80, totalFat: 28 },
    { date: new Date('2026-06-01T12:00:00.000Z'), totalCalories: 2100, totalProtein: 170, totalCarbs: 210, totalFat: 64 },
    { date: new Date('2026-05-31T12:00:00.000Z'), totalCalories: 1900, totalProtein: 145, totalCarbs: 190, totalFat: 55 },
    { date: new Date('2026-05-29T12:00:00.000Z'), totalCalories: 2200, totalProtein: 185, totalCarbs: 215, totalFat: 70 },
  ];

  it('computes dashboard streak stats from recent logged meals', () => {
    const streaks = buildDashboardStreaks({
      currentDate: '2026-06-02T00:00:00.000Z',
      meals,
      proteinGoal: 160,
    });

    expect(streaks.currentStreakDays).toBe(3);
    expect(streaks.mealsLoggedThisWeek).toBe(4);
    expect(streaks.proteinGoalHitDaysThisWeek).toBe(3);
    expect(streaks.summary).toMatch(/3 day streak/i);
    expect(streaks.milestone.nextMilestone).toBe(7);
    expect(streaks.milestone.message).toBe('4 days until your 7-day streak.');
  });

  it('builds subtle streak milestone progress copy', () => {
    expect(buildStreakMilestone(5)).toMatchObject({
      nextMilestone: 7,
      daysUntilNext: 2,
      message: '2 days until your 7-day streak.',
    });
    expect(buildStreakMilestone(15)).toMatchObject({
      nextMilestone: 30,
      message: "You're halfway to a 30-day streak.",
    });
    expect(buildStreakMilestone(100)).toMatchObject({
      nextMilestone: null,
      message: '100-day streak reached. Keep the rhythm steady.',
    });
  });

  it('builds calorie and protein analytics for seven and thirty day windows', () => {
    const analytics = buildNutritionAnalytics({
      currentDate: '2026-06-02T00:00:00.000Z',
      meals,
      calorieGoal: 2100,
      proteinGoal: 160,
    });

    expect(analytics.sevenDayAverageCalories).toBe(1775);
    expect(analytics.sevenDayAverageProtein).toBe(149);
    expect(analytics.thirtyDayAverageCalories).toBe(1775);
    expect(analytics.highestProteinDay?.protein).toBe(185);
    expect(analytics.macroConsistencySummary).toMatch(/protein|calorie|consistent/i);
  });

  it('calculates explainable macro goals for a guided setup', () => {
    const targets = calculateGoalTargets({
      weightLbs: 180,
      goalWeightLbs: 170,
      goal: 'LOSE_WEIGHT',
      activityLevel: 'MODERATE',
      ratePerWeekLbs: 1,
      proteinPreference: 'high',
    });

    expect(targets.dailyCalorieGoal).toBeGreaterThanOrEqual(1500);
    expect(targets.dailyCalorieGoal).toBeLessThan(2600);
    expect(targets.proteinGoal).toBeGreaterThanOrEqual(160);
    expect(targets.fatGoal).toBeGreaterThan(40);
    expect(targets.carbsGoal).toBeGreaterThan(0);
  });

  it('summarizes weight trend without mutating profile weight', () => {
    const trend = summarizeWeightTrend([
      { date: new Date('2026-05-20T00:00:00.000Z'), weightLbs: 184 },
      { date: new Date('2026-05-27T00:00:00.000Z'), weightLbs: 182.5 },
      { date: new Date('2026-06-02T00:00:00.000Z'), weightLbs: 181 },
    ]);

    expect(trend.latestWeightLbs).toBe(181);
    expect(trend.changeLbs).toBe(-3);
    expect(trend.direction).toBe('down');
  });
});
