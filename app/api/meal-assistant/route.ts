import { NextResponse } from 'next/server';

import { mealAssistantRequestSchema } from '@/lib/ai/mealAssistantSchema';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import { getCurrentUserWithProfile } from '@/lib/current-user';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, state } = mealAssistantRequestSchema.parse(body);
    const user = await getCurrentUserWithProfile();

    const response = await runMealAssistant({
      message,
      state: {
        ...state,
        userName: state.userName ?? user?.name ?? null,
      },
      userPreferences: user?.profile?.aiPreferenceNotes ?? null,
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
