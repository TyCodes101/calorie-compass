import { NextResponse } from 'next/server';

import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { buildNutritionAnalytics, summarizeWeightTrend } from '@/lib/growth-metrics';
import { logWriteFailure } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUserWithProfile();

    if (!user || !user.profile || !hasDatabaseConnectionString()) {
      return NextResponse.json({
        analytics: buildNutritionAnalytics({ meals: [], calorieGoal: 2200, proteinGoal: 160 }),
        weightTrend: summarizeWeightTrend([]),
      });
    }

    const today = startOfDayUtc(new Date());
    const [meals, weightEntries] = await Promise.all([
      prisma.meal.findMany({
        where: {
          userId: user.id,
          date: {
            gte: addDaysUtc(today, -29),
            lte: today,
          },
        },
        select: {
          date: true,
          totalCalories: true,
          totalProtein: true,
          totalCarbs: true,
          totalFat: true,
        },
      }),
      prisma.weightEntry.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      analytics: buildNutritionAnalytics({
        currentDate: today,
        meals,
        calorieGoal: user.profile.dailyCalorieGoal,
        proteinGoal: user.profile.proteinGoal,
      }),
      weightTrend: summarizeWeightTrend(weightEntries),
    });
  } catch (error) {
    logWriteFailure('analytics.route.get', error);
    return NextResponse.json({
      analytics: buildNutritionAnalytics({ meals: [], calorieGoal: 2200, proteinGoal: 160 }),
      weightTrend: summarizeWeightTrend([]),
    });
  }
}
