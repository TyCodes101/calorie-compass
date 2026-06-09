import { NextResponse } from 'next/server';

import { getDashboardData } from '@/lib/dashboard';
import { addDaysUtc, startOfDayUtc } from '@/lib/date';
import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { isFixtureMealRecord } from '@/lib/meal-display';
import { logWriteFailure } from '@/lib/persistence';

export async function POST() {
  try {
    const user = await getCurrentUserWithProfile();

    if (!user) {
      return NextResponse.json({ copied: false, reason: 'unauthorized' }, { status: 401 });
    }

    if (!hasDatabaseConnectionString()) {
      return NextResponse.json({ copied: false, reason: 'localOnly' }, { status: 400 });
    }

    const today = startOfDayUtc(new Date());
    const tomorrow = addDaysUtc(today, 1);
    const yesterday = addDaysUtc(today, -1);

    const [todayMeals, yesterdayMeals] = await Promise.all([
      prisma.meal.findMany({
        where: {
          userId: user.id,
          date: { gte: today, lt: tomorrow },
        },
        include: { items: true },
      }),
      prisma.meal.findMany({
        where: {
          userId: user.id,
          date: { gte: yesterday, lt: today },
        },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const filteredToday = todayMeals.filter((meal) => !isFixtureMealRecord({ rawText: meal.rawText, items: meal.items }));
    if (filteredToday.length) {
      return NextResponse.json({ copied: false, reason: 'alreadyHasMeals' });
    }

    const filteredYesterday = yesterdayMeals.filter((meal) => !isFixtureMealRecord({ rawText: meal.rawText, items: meal.items }));
    if (!filteredYesterday.length) {
      return NextResponse.json({ copied: false, reason: 'empty' });
    }

    await prisma.$transaction(async (tx) => {
      for (const meal of filteredYesterday) {
        await tx.meal.create({
          data: {
            userId: user.id,
            mealType: meal.mealType,
            date: today,
            rawText: meal.rawText,
            notes: (meal.notes ?? '').trim() ? `${meal.notes}\n\nCopied from yesterday.` : 'Copied from yesterday.',
            confidenceScore: meal.confidenceScore,
            totalCalories: meal.totalCalories,
            totalProtein: meal.totalProtein,
            totalCarbs: meal.totalCarbs,
            totalFat: meal.totalFat,
            totalFiber: meal.totalFiber,
            totalSugar: meal.totalSugar,
            totalSodium: meal.totalSodium,
            items: {
              create: meal.items.map((item) => ({
                foodName: item.foodName,
                quantity: item.quantity,
                unit: item.unit,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                fiber: item.fiber,
                sugar: item.sugar,
                sodium: item.sodium,
                notes: item.notes,
                nutritionSourceType: item.nutritionSourceType,
                nutritionSourceName: item.nutritionSourceName,
                catalogFoodId: item.catalogFoodId,
                mealType: meal.mealType,
                date: today,
                confidenceScore: meal.confidenceScore,
              })),
            },
          },
        });
      }

      await tx.dailyLog.upsert({
        where: { userId_date: { userId: user.id, date: today } },
        update: {},
        create: { userId: user.id, date: today },
      });
    });

    const dashboard = await getDashboardData(today);
    return NextResponse.json({ copied: true, mealCount: filteredYesterday.length, dashboard });
  } catch (error) {
    logWriteFailure('meal.copyYesterday', error);
    return NextResponse.json({ copied: false, reason: 'error' }, { status: 500 });
  }
}

