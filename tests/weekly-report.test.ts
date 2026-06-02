import { describe, expect, it } from 'vitest';

import { buildWeeklyReport } from '@/lib/weekly-report';

describe('weekly report helpers', () => {
  it('builds a calm weekly report from the last seven days of meals', () => {
    const report = buildWeeklyReport({
      currentDate: '2026-06-02T00:00:00.000Z',
      calorieGoal: 2100,
      proteinGoal: 160,
      meals: [
        { date: new Date('2026-06-02T12:00:00.000Z'), mealType: 'LUNCH', totalCalories: 900, totalProtein: 92 },
        { date: new Date('2026-06-01T12:00:00.000Z'), mealType: 'DINNER', totalCalories: 2100, totalProtein: 172 },
        { date: new Date('2026-05-31T12:00:00.000Z'), mealType: 'BREAKFAST', totalCalories: 1900, totalProtein: 145 },
        { date: new Date('2026-05-28T12:00:00.000Z'), mealType: 'LUNCH', totalCalories: 2200, totalProtein: 185 },
      ],
    });

    expect(report.startDate).toBe('2026-05-27');
    expect(report.endDate).toBe('2026-06-02');
    expect(report.loggedDays).toBe(4);
    expect(report.mealCount).toBe(4);
    expect(report.averageCalories).toBe(1775);
    expect(report.averageProtein).toBe(149);
    expect(report.calorieTargetDays).toBe(3);
    expect(report.proteinTargetDays).toBe(2);
    expect(report.topMealType).toBe('lunch');
    expect(report.summary).toMatch(/4 of 7 days/i);
    expect(report.highlights.join(' ')).toMatch(/protein|calorie|lunch/i);
  });

  it('returns an empty-state report without pretending progress exists', () => {
    const report = buildWeeklyReport({
      currentDate: '2026-06-02T00:00:00.000Z',
      calorieGoal: 2100,
      proteinGoal: 160,
      meals: [],
    });

    expect(report.loggedDays).toBe(0);
    expect(report.mealCount).toBe(0);
    expect(report.averageCalories).toBe(0);
    expect(report.averageProtein).toBe(0);
    expect(report.summary).toMatch(/No weekly report yet/i);
    expect(report.highlights).toContain('Log a few meals this week to unlock a useful report.');
  });
});
