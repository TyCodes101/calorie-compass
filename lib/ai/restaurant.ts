import type { ParsedMealResponse } from '@/lib/ai/types';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';

export function getRestaurantEstimate(text: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): ParsedMealResponse | null {
  const lower = text.toLowerCase();

  if (!/chipotle|starbucks|chick-fil-a|chick fil a|mcdonald|mcdonalds/.test(lower)) {
    return null;
  }

  return getTrustedCatalogEstimate(text, mealType);
}
