import { z } from 'zod';

import { parsedFoodItemSchema, type ParsedFoodItem, type ParsedMealResponse } from '@/lib/ai/types';

export type PendingMealStatus =
  | 'draft'
  | 'needs_clarification'
  | 'ready_for_review'
  | 'saving'
  | 'saved'
  | 'cancelled'
  | 'failed';

export type PendingMealSourceSummary = {
  sourceTypes: string[];
  sourceNames: string[];
  trustedItemCount: number;
  estimatedItemCount: number;
};

export type PendingMeal = {
  id: string;
  version: number;
  items: ParsedFoodItem[];
  totals: ParsedMealResponse['totals'];
  aggregateConfidence: number;
  sourceSummary: PendingMealSourceSummary;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  status: PendingMealStatus;
  clarification: string | null;
  createdAt: string;
  updatedAt: string;
  lastResolvedAt: string;
};

const nutritionTotalsSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
});

export const pendingMealSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  items: z.array(parsedFoodItemSchema),
  totals: nutritionTotalsSchema,
  aggregateConfidence: z.number().min(0).max(1),
  sourceSummary: z.object({
    sourceTypes: z.array(z.string()),
    sourceNames: z.array(z.string()),
    trustedItemCount: z.number().int().nonnegative(),
    estimatedItemCount: z.number().int().nonnegative(),
  }),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  status: z.enum(['draft', 'needs_clarification', 'ready_for_review', 'saving', 'saved', 'cancelled', 'failed']),
  clarification: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastResolvedAt: z.string(),
});

type PendingMealOptions = {
  id?: string;
  now?: string;
  status?: PendingMealStatus;
  clarification?: string | null;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function totals(items: ParsedFoodItem[]): ParsedMealResponse['totals'] {
  return items.reduce((sum, item) => ({
    calories: round(sum.calories + item.calories),
    protein: round(sum.protein + item.protein),
    carbs: round(sum.carbs + item.carbs),
    fat: round(sum.fat + item.fat),
    fiber: round(sum.fiber + item.fiber),
    sugar: round(sum.sugar + item.sugar),
    sodium: round(sum.sodium + item.sodium),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
}

function sourceSummary(items: ParsedFoodItem[]): PendingMealSourceSummary {
  const sourceTypes = [...new Set(items.map((item) => item.source_type).filter((value): value is NonNullable<ParsedFoodItem['source_type']> => Boolean(value)))];
  const sourceNames = [...new Set(items.map((item) => item.source_name).filter((value): value is string => Boolean(value)))];
  const estimatedItemCount = items.filter((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback || !item.is_trusted).length;

  return {
    sourceTypes,
    sourceNames,
    trustedItemCount: Math.max(0, items.length - estimatedItemCount),
    estimatedItemCount,
  };
}

function makePendingMealId() {
  return globalThis.crypto?.randomUUID?.() ?? `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneItems(items: ParsedFoodItem[]) {
  return items.map((item) => ({ ...item }));
}

function withStatus(
  pending: PendingMeal,
  status: PendingMealStatus,
  clarification: string | null,
  now = new Date().toISOString(),
): PendingMeal {
  return {
    ...pending,
    items: cloneItems(pending.items),
    totals: { ...pending.totals },
    sourceSummary: {
      ...pending.sourceSummary,
      sourceTypes: [...pending.sourceSummary.sourceTypes],
      sourceNames: [...pending.sourceSummary.sourceNames],
    },
    status,
    clarification,
    updatedAt: now,
  };
}

export function pendingMealItemSignature(items: ParsedFoodItem[]) {
  return JSON.stringify(items.map((item) => ({
    foodName: item.food_name,
    quantity: round(item.quantity),
    unit: item.unit,
    calories: round(item.calories),
    protein: round(item.protein),
    carbs: round(item.carbs),
    fat: round(item.fat),
    sourceType: item.source_type ?? null,
    catalogFoodId: item.catalog_food_id ?? null,
  })));
}

export function createPendingMeal(
  items: ParsedFoodItem[],
  mealType: PendingMeal['mealType'],
  confidence: number,
  options: PendingMealOptions = {},
): PendingMeal {
  const now = options.now ?? new Date().toISOString();
  const status = options.status ?? (items.length ? 'ready_for_review' : 'draft');

  return {
    id: options.id ?? makePendingMealId(),
    version: 1,
    items: cloneItems(items),
    totals: totals(items),
    aggregateConfidence: confidence,
    sourceSummary: sourceSummary(items),
    mealType,
    status,
    clarification: options.clarification ?? null,
    createdAt: now,
    updatedAt: now,
    lastResolvedAt: now,
  };
}

export function buildPendingMealSaveIdempotencyKey(pending: PendingMeal | null | undefined) {
  return pending ? `${pending.id}:v${pending.version}` : null;
}

export function preservePendingMeal(pending: PendingMeal): PendingMeal {
  return withStatus(pending, pending.status, pending.clarification, pending.updatedAt);
}

function updatePendingMealItems(
  pending: PendingMeal,
  items: ParsedFoodItem[],
  confidence: number,
  now = new Date().toISOString(),
): PendingMeal {
  const nextItems = cloneItems(items);
  return {
    ...pending,
    version: pending.version + 1,
    items: nextItems,
    totals: totals(nextItems),
    aggregateConfidence: confidence,
    sourceSummary: sourceSummary(nextItems),
    status: nextItems.length ? 'ready_for_review' : 'draft',
    clarification: null,
    updatedAt: now,
    lastResolvedAt: now,
  };
}

export function addPendingMealItems(
  pending: PendingMeal,
  items: ParsedFoodItem[],
  confidence: number,
  now = new Date().toISOString(),
): PendingMeal {
  return updatePendingMealItems(pending, [...pending.items, ...items], confidence, now);
}

export function replacePendingMealItems(
  pending: PendingMeal,
  items: ParsedFoodItem[],
  confidence: number,
  now = new Date().toISOString(),
): PendingMeal {
  return updatePendingMealItems(pending, items, confidence, now);
}

export function markPendingMealNeedsClarification(
  pending: PendingMeal,
  clarification: string,
  now = new Date().toISOString(),
): PendingMeal {
  return withStatus(pending, 'needs_clarification', clarification, now);
}

export function markPendingMealReadyForReview(pending: PendingMeal, now = new Date().toISOString()): PendingMeal {
  return withStatus(pending, 'ready_for_review', null, now);
}

export function markPendingMealSaving(pending: PendingMeal, now = new Date().toISOString()): PendingMeal {
  return withStatus(pending, 'saving', null, now);
}

export function markPendingMealSaved(pending: PendingMeal, now = new Date().toISOString()): PendingMeal {
  return withStatus(pending, 'saved', null, now);
}

export function markPendingMealFailed(pending: PendingMeal, now = new Date().toISOString()): PendingMeal {
  return withStatus(pending, 'failed', pending.clarification, now);
}

export function cancelPendingMeal(_pending: PendingMeal): null {
  void _pending;
  return null;
}

export function reconcilePendingMeal(args: {
  existing?: PendingMeal | null;
  items: ParsedFoodItem[];
  mealType: PendingMeal['mealType'];
  confidence: number;
  saved: boolean;
  clarification?: string | null;
  cancelled?: boolean;
  now?: string;
}): PendingMeal | null {
  if (args.cancelled) {
    return null;
  }

  const now = args.now ?? new Date().toISOString();
  const existing = args.existing ?? null;
  const itemsChanged = existing
    ? pendingMealItemSignature(existing.items) !== pendingMealItemSignature(args.items)
      || existing.mealType !== args.mealType
    : args.items.length > 0;

  let pending: PendingMeal | null = existing;

  if (args.items.length) {
    if (!existing) {
      pending = createPendingMeal(args.items, args.mealType, args.confidence, { now });
    } else if (itemsChanged) {
      pending = replacePendingMealItems(existing, args.items, args.confidence, now);
      pending.mealType = args.mealType;
    }
  } else if (!existing && args.clarification) {
    pending = createPendingMeal([], args.mealType, args.confidence, {
      now,
      status: 'needs_clarification',
      clarification: args.clarification,
    });
  }

  if (!pending) {
    return null;
  }

  if (args.saved) {
    return markPendingMealSaved(pending, now);
  }

  if (args.clarification) {
    return markPendingMealNeedsClarification(pending, args.clarification, now);
  }

  if (pending.items.length && pending.status !== 'ready_for_review') {
    return markPendingMealReadyForReview(pending, now);
  }

  return preservePendingMeal(pending);
}
