import type { ParsedMealResponse } from '@/lib/ai/types';
import type { NutritionLookupProvider } from '@/lib/nutrition/types';

export function createAiEstimateProvider(
  estimate: (input: { text: string; mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' }) => Promise<ParsedMealResponse | null> | ParsedMealResponse | null,
): NutritionLookupProvider {
  return {
    id: 'ai-estimate-fallback',
    lookup({ text, mealType }) {
      return estimate({ text, mealType });
    },
  };
}
