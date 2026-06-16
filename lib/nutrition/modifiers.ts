import type { ParsedFoodItem } from '@/lib/ai/types';

export type NutritionModifier = 'no cheese' | 'extra cheese' | 'footlong' | 'grilled' | 'buttered';

export type NutritionModifierContext = {
  text?: string | null;
  modifiers?: string[] | null;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function unique(values: NutritionModifier[]) {
  return [...new Set(values)];
}

export function extractNutritionModifiers(text: string | null | undefined): NutritionModifier[] {
  const normalized = text ?? '';
  const modifiers: NutritionModifier[] = [];

  if (/\b(?:no|without|hold(?:\s+the)?)\s+cheese\b/i.test(normalized)) modifiers.push('no cheese');
  if (/\bextra\s+cheese\b/i.test(normalized)) modifiers.push('extra cheese');
  if (/\bfoot\s*long\b|\bfootlong\b/i.test(normalized)) modifiers.push('footlong');
  if (/\bgrilled\b/i.test(normalized)) modifiers.push('grilled');
  if (/\bbuttered\b|\bwith\s+butter\b/i.test(normalized)) modifiers.push('buttered');

  return unique(modifiers);
}

function modifiersFromContext(context: NutritionModifierContext) {
  const explicit = (context.modifiers ?? [])
    .map((modifier) => modifier.toLowerCase().trim())
    .filter(Boolean) as NutritionModifier[];
  return unique([...explicit, ...extractNutritionModifiers(context.text)]);
}

function appendNote(item: ParsedFoodItem, note: string) {
  if (item.notes?.toLowerCase().includes(note.toLowerCase())) {
    return item.notes;
  }
  return [item.notes, note].filter(Boolean).join(' ');
}

function applyMcDoubleNoCheese(item: ParsedFoodItem) {
  if (!/\bmcdouble\b/i.test(item.food_name) || /no cheese adjustment/i.test(item.notes ?? '')) {
    return item;
  }

  return {
    ...item,
    calories: Math.max(0, round(item.calories - 50)),
    protein: Math.max(0, round(item.protein - 3)),
    carbs: Math.max(0, round(item.carbs - 2)),
    fat: Math.max(0, round(item.fat - 4)),
    sodium: Math.max(0, round(item.sodium - 190)),
    notes: appendNote(item, 'No cheese adjustment applied after the McDouble identity match.'),
  };
}

function scaleNutrients(item: ParsedFoodItem, factor: number) {
  return {
    calories: round(item.calories * factor),
    protein: round(item.protein * factor),
    carbs: round(item.carbs * factor),
    fat: round(item.fat * factor),
    fiber: round(item.fiber * factor),
    sugar: round(item.sugar * factor),
    sodium: round(item.sodium * factor),
  };
}

function applySubwayFootlong(item: ParsedFoodItem) {
  const sourceText = `${item.food_name} ${item.source_name ?? ''} ${item.notes ?? ''}`;
  const isSubwaySixInch = /\bsubway\b/i.test(sourceText) && /\b6[- ]inch\b/i.test(sourceText);
  if (!isSubwaySixInch || /\bfootlong\b/i.test(item.unit) || /footlong adjustment/i.test(item.notes ?? '')) {
    return item;
  }

  return {
    ...item,
    food_name: item.food_name.replace(/\b6[- ]inch\b/i, 'Footlong'),
    unit: 'footlong',
    ...scaleNutrients(item, 2),
    notes: appendNote(item, 'Footlong adjustment applied from the verified 6-inch restaurant serving.'),
  };
}

export function applyNutritionModifiers<T extends ParsedFoodItem>(
  items: T[],
  context: NutritionModifierContext,
): T[] {
  const modifiers = modifiersFromContext(context);

  return items.map((item) => {
    let next: ParsedFoodItem = item;
    if (modifiers.includes('no cheese')) {
      next = applyMcDoubleNoCheese(next);
    }
    if (modifiers.includes('footlong')) {
      next = applySubwayFootlong(next);
    }
    return next as T;
  });
}
