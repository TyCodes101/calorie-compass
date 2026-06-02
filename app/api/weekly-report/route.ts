import { NextResponse } from 'next/server';

import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { logWriteFailure } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';
import { buildWeeklyReport } from '@/lib/weekly-report';

export async function GET() {
  try {
    const user = await getCurrentUserWithProfile();
    const today = startOfDayUtc(new Date());

    if (!user?.profile || !hasDatabaseConnectionString()) {
      return NextResponse.json({
        weeklyReport: buildWeeklyReport({ currentDate: today, meals: [], calorieGoal: 2200, proteinGoal: 160 }),
      });
    }

    const meals = await prisma.meal.findMany({
      where: {
        userId: user.id,
        date: {
          gte: addDaysUtc(today, -6),
          lt: addDaysUtc(today, 1),
        },
      },
      select: {
        date: true,
        mealType: true,
        totalCalories: true,
        totalProtein: true,
      },
    });

    return NextResponse.json({
      weeklyReport: buildWeeklyReport({
        currentDate: today,
        meals,
        calorieGoal: user.profile.dailyCalorieGoal,
        proteinGoal: user.profile.proteinGoal,
      }),
    });
  } catch (error) {
    logWriteFailure('weekly-report.route.get', error);
    return NextResponse.json({
      weeklyReport: buildWeeklyReport({ meals: [], calorieGoal: 2200, proteinGoal: 160 }),
    });
  }
}
