import { parsedMealResponseSchema, type ParsedMealResponse } from '@/lib/ai/types';
import { sanitizeNumber, sumNutrition } from '@/lib/nutrition';

function normalizeItem(item: Record<string, unknown>) {
  return {
    food_name: String(item.food_name ?? item.foodName ?? 'Unknown item').trim() || 'Unknown item',
    quantity: sanitizeNumber(item.quantity ?? 1),
    unit: String(item.unit ?? 'serving').trim() || 'serving',
    calories: sanitizeNumber(item.calories),
    protein: sanitizeNumber(item.protein),
    carbs: sanitizeNumber(item.carbs),
    fat: sanitizeNumber(item.fat),
    fiber: sanitizeNumber(item.fiber),
    sugar: sanitizeNumber(item.sugar),
    sodium: sanitizeNumber(item.sodium),
    notes: item.notes ? String(item.notes) : null,
    is_trusted: Boolean(item.is_trusted ?? item.isTrusted ?? false),
    source_type: item.source_type ? String(item.source_type) : item.sourceType ? String(item.sourceType) : null,
    source_name: item.source_name ? String(item.source_name) : item.sourceName ? String(item.sourceName) : null,
    catalog_food_id:
      item.catalog_food_id ? String(item.catalog_food_id) : item.catalogFoodId ? String(item.catalogFoodId) : null,
  };
}

export function normalizeParsedMealResponse(input: unknown): ParsedMealResponse {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const items = Array.isArray(raw.items) ? raw.items.map((item) => normalizeItem(item as Record<string, unknown>)) : [];
  const fallbackTotals = sumNutrition(items);

  const normalized = {
    needs_clarification: Boolean(raw.needs_clarification),
    clarifying_question: raw.clarifying_question ? String(raw.clarifying_question) : null,
    meal_type: ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(raw.meal_type))
      ? (raw.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack')
      : 'lunch',
    confidence_score: Math.max(0, Math.min(1, sanitizeNumber(raw.confidence_score ?? 0.65))),
    items,
    totals: {
      calories: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.calories ?? fallbackTotals.calories),
      protein: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.protein ?? fallbackTotals.protein),
      carbs: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.carbs ?? fallbackTotals.carbs),
      fat: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.fat ?? fallbackTotals.fat),
      fiber: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.fiber ?? fallbackTotals.fiber),
      sugar: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.sugar ?? fallbackTotals.sugar),
      sodium: sanitizeNumber((raw.totals as Record<string, unknown> | undefined)?.sodium ?? fallbackTotals.sodium),
    },
  };

  if (normalized.needs_clarification && !normalized.clarifying_question) {
    normalized.clarifying_question = 'Can you share the portion size and any details like grilled, fried, or sauced?';
  }

  return parsedMealResponseSchema.parse(normalized);
}
