import { MealLoggerClient } from '@/components/meal-logger-client';
import { getPreferredUserName } from '@/lib/auth-session';
import { seedAssistantMemoryFromSavedMeals } from '@/lib/assistant-memory';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { getDashboardData } from '@/lib/dashboard';
import { getRecentMealsForQuickLog } from '@/lib/history';
import { getFavoriteMeals, getLoggerDraft } from '@/lib/reusable-meals';

type LoggerPageProps = {
  searchParams?: Promise<{
    mealId?: string | string[];
    favorite?: string | string[];
    editMealId?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function LoggerPage({ searchParams }: LoggerPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const mealId = pickFirst(params?.mealId);
  const reusableMealId = pickFirst(params?.favorite);
  const editMealId = pickFirst(params?.editMealId);
  const [initialDraft, favoriteMeals, recentMeals, user, dashboard] = await Promise.all([
    getLoggerDraft({
      mealId,
      reusableMealId,
      editMealId,
    }),
    getFavoriteMeals(),
    getRecentMealsForQuickLog(12),
    getCurrentUserWithProfile(),
    getDashboardData(),
  ]);
  const seedAssistantMemory = seedAssistantMemoryFromSavedMeals({ favoriteMeals, recentMeals });

  return (
    <MealLoggerClient
      key={editMealId ?? reusableMealId ?? mealId ?? 'new'}
      initialDraft={initialDraft}
      favoriteMeals={favoriteMeals}
      recentMeals={recentMeals}
      seedAssistantMemory={seedAssistantMemory}
      nutritionPreferences={user?.profile?.aiPreferenceNotes ?? null}
      userName={getPreferredUserName(user)}
      proteinGoal={user?.profile?.proteinGoal ?? null}
      dailyCalorieGoal={user?.profile?.dailyCalorieGoal ?? null}
      todayProtein={dashboard?.totals.protein ?? 0}
      todayCarbs={dashboard?.totals.carbs ?? 0}
      todayFat={dashboard?.totals.fat ?? 0}
      todayCalories={dashboard?.totals.calories ?? 0}
      remainingProtein={dashboard ? Math.max(0, Math.round(dashboard.macroGoals.protein - dashboard.totals.protein)) : null}
      remainingCarbs={dashboard ? Math.max(0, Math.round(dashboard.macroGoals.carbs - dashboard.totals.carbs)) : null}
      remainingFat={dashboard ? Math.max(0, Math.round(dashboard.macroGoals.fat - dashboard.totals.fat)) : null}
      remainingCalories={dashboard?.remainingCalories ?? null}
      todayMealCount={dashboard?.mealCount ?? 0}
    />
  );
}
