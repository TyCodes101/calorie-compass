import { NextResponse } from 'next/server';

import { mealAssistantRequestSchema } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, state, context } = mealAssistantRequestSchema.parse(body);
    const user = await getCurrentUserWithProfile();

    const response = await runMealAssistant({
      message,
      state: {
        ...state,
        userName: state.userName ?? user?.name ?? null,
      },
      context: {
        favoriteMeals: context?.favoriteMeals ?? [],
        recentMeals: context?.recentMeals ?? [],
        assistantMemory: context?.assistantMemory,
        nutritionPreferences: context?.nutritionPreferences ?? user?.profile?.aiPreferenceNotes ?? null,
        proteinGoal: context?.proteinGoal ?? user?.profile?.proteinGoal ?? null,
        dailyCalorieGoal: context?.dailyCalorieGoal ?? user?.profile?.dailyCalorieGoal ?? null,
        todayProtein: context?.todayProtein ?? null,
        todayCarbs: context?.todayCarbs ?? null,
        todayFat: context?.todayFat ?? null,
        todayCalories: context?.todayCalories ?? null,
        remainingProtein: context?.remainingProtein ?? null,
        remainingCarbs: context?.remainingCarbs ?? null,
        remainingFat: context?.remainingFat ?? null,
        remainingCalories: context?.remainingCalories ?? null,
        todayMealCount: context?.todayMealCount ?? null,
      },
      userPreferences: context?.nutritionPreferences ?? user?.profile?.aiPreferenceNotes ?? null,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('meal-assistant error', error);
    return NextResponse.json(
      {
        error: 'We could not update that meal right now. Please try again.',
      },
      { status: 500 },
    );
  }
}
