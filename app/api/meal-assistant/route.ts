import { NextResponse } from 'next/server';

import { mealAssistantRequestSchema } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { ApiRequestParseError, parseJsonRequest } from '@/lib/api-request';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export async function POST(request: Request) {
  try {
    const { message, state, context, conversationHistory } = await parseJsonRequest(
      request,
      mealAssistantRequestSchema,
      'That meal update request was incomplete. Please try again.',
    );
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
      conversationHistory: conversationHistory ?? [],
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ApiRequestParseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('meal-assistant error', error);
    return NextResponse.json(
      {
        error: 'We could not update that meal right now. Please try again.',
      },
      { status: 500 },
    );
  }
}
