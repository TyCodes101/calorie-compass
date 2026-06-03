import { NextResponse } from 'next/server';

import { getDashboardData } from '@/lib/dashboard';
import { isDatabaseWriteError, logWriteFailure } from '@/lib/persistence';
import { repeatReusableMeal } from '@/lib/reusable-meals';

export async function POST(_request: Request, context: { params: Promise<{ reusableMealId: string }> }) {
  const { reusableMealId } = await context.params;

  try {
    const meal = await repeatReusableMeal(reusableMealId);
    const dashboard = await getDashboardData(meal.date);

    return NextResponse.json({ meal, dashboard });
  } catch (error) {
    logWriteFailure('favorite.route.repeat', error, { reusableMealId });

    if (isDatabaseWriteError(error)) {
      return NextResponse.json({ error: "We couldn't repeat that meal right now. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ error: "We couldn't repeat that meal right now. Please try again." }, { status: 500 });
  }
}
