import { NextResponse } from 'next/server';

import { mealAssistantRequestSchema } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { ApiRequestParseError, parseJsonRequest } from '@/lib/api-request';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import {
  createFoodPipelineTrace,
  finishFoodPipelineTrace,
  logFoodPipelineTrace,
  sanitizedFoodPipelineTrace,
} from '@/lib/ai/foodPipelineTrace';
import { getFoodPipelineEnvironmentStatus } from '@/lib/ai/runtimeConfig';
import { getReusableMealLibrary } from '@/lib/reusable-meals';

function sanitizedErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name };
  }

  return { name: typeof error };
}

export async function POST(request: Request) {
  const headerRequestId = request.headers.get('x-request-id')?.trim();
  const requestId = headerRequestId && /^[a-zA-Z0-9._:-]{1,128}$/.test(headerRequestId) ? headerRequestId : undefined;
  const trace = createFoodPipelineTrace({ requestId });
  const makeResponse = (body: unknown, status = 200) => {
    finishFoodPipelineTrace(trace, {
      usedAiEstimate: trace.usedAiEstimate,
      usedMock: trace.usedMock,
      clarificationRequired: trace.clarificationRequired,
    });
    logFoodPipelineTrace(trace);
    const response = NextResponse.json(body, { status });
    response.headers.set('x-macromesh-request-id', trace.requestId);
    return response;
  };

  try {
    const { message, state, context, conversationHistory } = await parseJsonRequest(
      request,
      mealAssistantRequestSchema,
      'That meal update request was incomplete. Please try again.',
    );
    const [user, reusableMeals] = await Promise.all([
      getCurrentUserWithProfile(),
      getReusableMealLibrary(),
    ]);
    const toMemoryMeal = (meal: (typeof reusableMeals.favoriteMeals)[number]) => ({
      id: meal.id,
      title: meal.title,
      rawText: meal.rawText,
      mealType: meal.mealType,
      totalCalories: meal.totalCalories,
      confidenceScore: meal.confidenceScore ?? 0.82,
      lastUsedAt: meal.lastUsedAt,
      items: meal.items ?? [],
    });
    const favoriteMeals = context?.favoriteMeals?.length
      ? context.favoriteMeals
      : reusableMeals.favoriteMeals.map(toMemoryMeal);
    const recentMeals = context?.recentMeals?.length
      ? context.recentMeals
      : reusableMeals.recentMeals.map(toMemoryMeal);

    const response = await runMealAssistant({
      message,
      state: {
        ...state,
        userName: state.userName ?? user?.name ?? null,
      },
      context: {
        favoriteMeals,
        recentMeals,
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
    }, { trace });

    finishFoodPipelineTrace(trace, {
      clarificationRequired: Boolean(response.next_state.pendingClarification),
      usedAiEstimate: response.meal.items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback),
    });
    const environment = getFoodPipelineEnvironmentStatus();
    const responseBody = environment.foodPipelineDebug && environment.nodeEnv !== 'production'
      ? { ...response, pipeline_debug: sanitizedFoodPipelineTrace(trace) }
      : response;
    return makeResponse(responseBody);
  } catch (error) {
    if (error instanceof ApiRequestParseError) {
      trace.failureReasons.push('invalid_request');
      return makeResponse({ error: error.message }, error.status);
    }

    trace.failureReasons.push('route_error');
    console.error('meal-assistant error', sanitizedErrorSummary(error));
    return makeResponse(
      {
        error: 'We could not update that meal right now. Please try again.',
      },
      500,
    );
  }
}
