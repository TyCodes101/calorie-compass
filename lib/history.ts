import { prisma } from '@/lib/prisma';
import { isoDay } from '@/lib/date';
import { summarizeStoredItems } from '@/lib/trust';

export type MealHistoryEntry = {
  id: string;
  title: string;
  mealType: string;
  time: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  trustedCount: number;
  estimatedCount: number;
};

export type MealHistoryGroup = {
  date: string;
  meals: MealHistoryEntry[];
};

export async function getMealHistory(): Promise<MealHistoryGroup[]> {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!user) {
    return [];
  }

  const meals = await prisma.meal.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 40,
  });

  const grouped = new Map<string, MealHistoryEntry[]>();

  for (const meal of meals) {
    const key = isoDay(meal.date);
    const summary = summarizeStoredItems(meal.items);
    const title = meal.rawText || `${meal.items.length} item meal`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key)?.push({
      id: meal.id,
      title,
      mealType: meal.mealType.toLowerCase(),
      time: meal.createdAt.toISOString(),
      totalCalories: Math.round(meal.totalCalories),
      totalProtein: Math.round(meal.totalProtein),
      totalCarbs: Math.round(meal.totalCarbs),
      totalFat: Math.round(meal.totalFat),
      trustedCount: summary.trustedCount,
      estimatedCount: summary.estimatedCount,
    });
  }

  return Array.from(grouped.entries()).map(([date, mealsForDay]) => ({
    date,
    meals: mealsForDay,
  }));
}

