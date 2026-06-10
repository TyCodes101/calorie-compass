import type { ParsedMealResponse } from '@/lib/ai/types';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';

export function getRestaurantEstimate(text: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): ParsedMealResponse | null {
  const lower = text.toLowerCase();

  if (!/arby|arbys|chipotle|starbucks|chick-fil-a|chick fil a|chic fil a|mcdonald|mcdonalds|subway|white castle|burger king|taco bell|wendy|panera/.test(lower)) {
    return null;
  }

  return getTrustedCatalogEstimate(text, mealType);
}
