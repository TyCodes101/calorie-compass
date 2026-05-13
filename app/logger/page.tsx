import { MealLoggerClient } from '@/components/meal-logger-client';
import { getLoggerDraft } from '@/lib/reusable-meals';

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
  const initialDraft = await getLoggerDraft({
    mealId,
    reusableMealId,
    editMealId,
  });

  return <MealLoggerClient key={editMealId ?? reusableMealId ?? mealId ?? 'new'} initialDraft={initialDraft} />;
}
