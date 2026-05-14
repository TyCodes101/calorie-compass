import { z } from 'zod';

import { parsedFoodItemSchema, type ParsedFoodItem } from '@/lib/ai/types';
import type { RecentMealQuickLog } from '@/lib/history';
import type { FavoriteMealSummary } from '@/lib/reusable-meals';

export const assistantMemoryStorageKey = 'calorie-compass.assistant-memory';
const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const assistantMemoryMealSchema = z.object({
  id: z.string(),
  title: z.string(),
  rawText: z.string().nullable().default(null),
  mealType: mealTypeSchema,
  totalCalories: z.number().nonnegative().default(0),
  confidenceScore: z.number().min(0).max(1).default(0.82),
  source: z.enum(['saved', 'favorite', 'recent', 'draft']).default('saved'),
  createdAt: z.string().nullable().default(null),
  lastUsedAt: z.string().nullable().default(null),
  count: z.number().int().positive().default(1),
  items: z.array(parsedFoodItemSchema).default([]),
});

const assistantMemoryNamedStatSchema = z.object({
  name: z.string(),
  count: z.number().int().positive().default(1),
  lastUsedAt: z.string().nullable().default(null),
});

const assistantMemoryServingSchema = z.object({
  foodName: z.string(),
  quantity: z.number().positive(),
  unit: z.string().nullable().default(null),
  count: z.number().int().positive().default(1),
  lastUsedAt: z.string().nullable().default(null),
});

const assistantMemoryCorrectionSchema = z.object({
  text: z.string(),
  count: z.number().int().positive().default(1),
  lastUsedAt: z.string().nullable().default(null),
});

const assistantMemoryMealTimingSchema = z.object({
  mealType: mealTypeSchema,
  averageHour: z.number().min(0).max(23).nullable().default(null),
  lastHour: z.number().min(0).max(23).nullable().default(null),
  count: z.number().int().nonnegative().default(0),
});

export const assistantMemorySchema = z.object({
  version: z.literal(1).default(1),
  syncStatus: z.literal('local').default('local'),
  updatedAt: z.string().nullable().default(null),
  recurringMeals: z.array(assistantMemoryMealSchema).default([]),
  recurringFoods: z.array(assistantMemoryNamedStatSchema).default([]),
  commonRestaurants: z.array(assistantMemoryNamedStatSchema).default([]),
  commonBrands: z.array(assistantMemoryNamedStatSchema).default([]),
  preferredServingSizes: z.array(assistantMemoryServingSchema).default([]),
  commonCorrections: z.array(assistantMemoryCorrectionSchema).default([]),
  mealTiming: z.array(assistantMemoryMealTimingSchema).default([]),
});

export type AssistantMemoryMeal = z.infer<typeof assistantMemoryMealSchema>;
export type AssistantMemorySnapshot = z.infer<typeof assistantMemorySchema>;

type AssistantMemorySeedInput = {
  favoriteMeals?: FavoriteMealSummary[];
  recentMeals?: RecentMealQuickLog[];
};

type AssistantMemoryMealInput = {
  title: string;
  rawText?: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: ParsedFoodItem[];
  confidenceScore?: number | null;
  source?: AssistantMemoryMeal['source'];
  occurredAt?: string | null;
};

const knownRestaurants = ['Chipotle', "McDonald's", 'Taco Bell', 'Starbucks', 'Chick-fil-A', 'Wendy\'s', 'Subway', 'Panera'];
const knownBrands = ['Fairlife', 'Quest', 'Premier Protein', 'Quaker', 'Daisy', 'Core Power', 'Chobani', 'Oikos', 'Gatorade'];

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sumCalories(items: ParsedFoodItem[]) {
  return items.reduce((sum, item) => sum + Number(item.calories || 0), 0);
}

function titleFromItems(items: ParsedFoodItem[]) {
  if (!items.length) {
    return 'Meal';
  }

  if (items.length === 1) {
    return items[0]?.food_name ?? 'Meal';
  }

  return items.slice(0, 3).map((item) => item.food_name).join(', ');
}

function stableMealId(input: AssistantMemoryMealInput) {
  const text = normalizeText(input.rawText || input.title || titleFromItems(input.items));
  const mealType = input.mealType;
  return `${mealType}:${text || 'meal'}`;
}

function rankByUsage<T extends { count: number; lastUsedAt: string | null }>(entries: T[]) {
  return [...entries].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return (Date.parse(right.lastUsedAt || '') || 0) - (Date.parse(left.lastUsedAt || '') || 0);
  });
}

function upsertNamedStat(
  entries: AssistantMemorySnapshot['recurringFoods'],
  name: string,
  occurredAt: string | null | undefined,
  limit: number,
) {
  const normalizedTarget = normalizeText(name);
  if (!normalizedTarget) {
    return entries;
  }

  const nextEntries = [...entries];
  const index = nextEntries.findIndex((entry) => normalizeText(entry.name) === normalizedTarget);

  if (index >= 0) {
    nextEntries[index] = {
      ...nextEntries[index],
      name: nextEntries[index]?.name ?? name,
      count: nextEntries[index].count + 1,
      lastUsedAt: occurredAt ?? nextEntries[index].lastUsedAt,
    };
  } else {
    nextEntries.push({
      name,
      count: 1,
      lastUsedAt: occurredAt ?? null,
    });
  }

  return rankByUsage(nextEntries).slice(0, limit);
}

function upsertServingPreference(
  entries: AssistantMemorySnapshot['preferredServingSizes'],
  item: ParsedFoodItem,
  occurredAt: string | null | undefined,
  limit: number,
) {
  const normalizedTarget = normalizeText(item.food_name);
  if (!normalizedTarget) {
    return entries;
  }

  const nextEntries = [...entries];
  const index = nextEntries.findIndex((entry) => normalizeText(entry.foodName) === normalizedTarget);

  if (index >= 0) {
    const previous = nextEntries[index];
    nextEntries[index] = {
      ...previous,
      quantity: item.quantity,
      unit: item.unit ?? previous.unit,
      count: previous.count + 1,
      lastUsedAt: occurredAt ?? previous.lastUsedAt,
    };
  } else {
    nextEntries.push({
      foodName: item.food_name,
      quantity: item.quantity,
      unit: item.unit ?? null,
      count: 1,
      lastUsedAt: occurredAt ?? null,
    });
  }

  return rankByUsage(nextEntries).slice(0, limit);
}

function extractKnownMatches(items: ParsedFoodItem[], haystack: string, options: string[]) {
  const lowerHaystack = haystack.toLowerCase();
  return options.filter((option) => {
    const normalizedOption = option.toLowerCase();
    return lowerHaystack.includes(normalizedOption) || items.some((item) => item.food_name.toLowerCase().includes(normalizedOption) || (item.source_name ?? '').toLowerCase().includes(normalizedOption));
  });
}

function rememberMealTiming(
  entries: AssistantMemorySnapshot['mealTiming'],
  mealType: AssistantMemoryMealInput['mealType'],
  occurredAt: string | null | undefined,
) {
  const nextEntries = [...entries];
  const hour = occurredAt ? new Date(occurredAt).getHours() : new Date().getHours();
  const index = nextEntries.findIndex((entry) => entry.mealType === mealType);

  if (index >= 0) {
    const current = nextEntries[index];
    const nextCount = current.count + 1;
    const runningAverage = current.averageHour === null ? hour : Number(((current.averageHour * current.count + hour) / nextCount).toFixed(1));
    nextEntries[index] = {
      mealType,
      averageHour: runningAverage,
      lastHour: hour,
      count: nextCount,
    };
  } else {
    nextEntries.push({
      mealType,
      averageHour: hour,
      lastHour: hour,
      count: 1,
    });
  }

  return nextEntries.sort((left, right) => left.mealType.localeCompare(right.mealType));
}

export function createEmptyAssistantMemory(): AssistantMemorySnapshot {
  return assistantMemorySchema.parse({
    version: 1,
    syncStatus: 'local',
    updatedAt: null,
    recurringMeals: [],
    recurringFoods: [],
    commonRestaurants: [],
    commonBrands: [],
    preferredServingSizes: [],
    commonCorrections: [],
    mealTiming: [],
  });
}

export function parseAssistantMemory(raw: string | null | undefined): AssistantMemorySnapshot {
  if (!raw) {
    return createEmptyAssistantMemory();
  }

  try {
    return assistantMemorySchema.parse(JSON.parse(raw));
  } catch {
    return createEmptyAssistantMemory();
  }
}

export function rememberAssistantMeal(memory: AssistantMemorySnapshot, input: AssistantMemoryMealInput): AssistantMemorySnapshot {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const normalizedTitle = (input.rawText ?? input.title ?? titleFromItems(input.items)).trim();
  const mealId = stableMealId(input);
  const recurringMeals = [...memory.recurringMeals];
  const mealIndex = recurringMeals.findIndex((entry) => entry.id === mealId);
  const totalCalories = Math.round(sumCalories(input.items));

  if (mealIndex >= 0) {
    const current = recurringMeals[mealIndex];
    recurringMeals[mealIndex] = {
      ...current,
      title: normalizedTitle || current.title,
      rawText: input.rawText ?? current.rawText,
      mealType: input.mealType,
      totalCalories: totalCalories || current.totalCalories,
      confidenceScore: input.confidenceScore ?? current.confidenceScore,
      source: input.source ?? current.source,
      lastUsedAt: occurredAt,
      count: current.count + 1,
      items: input.items.length ? input.items : current.items,
    };
  } else {
    recurringMeals.push({
      id: mealId,
      title: normalizedTitle || titleFromItems(input.items),
      rawText: input.rawText ?? null,
      mealType: input.mealType,
      totalCalories,
      confidenceScore: input.confidenceScore ?? 0.82,
      source: input.source ?? 'saved',
      createdAt: occurredAt,
      lastUsedAt: occurredAt,
      count: 1,
      items: input.items,
    });
  }

  let nextMemory: AssistantMemorySnapshot = {
    ...memory,
    updatedAt: occurredAt,
    recurringMeals: rankByUsage(recurringMeals).slice(0, 16),
    mealTiming: rememberMealTiming(memory.mealTiming, input.mealType, occurredAt),
  };

  for (const item of input.items) {
    nextMemory = {
      ...nextMemory,
      recurringFoods: upsertNamedStat(nextMemory.recurringFoods, item.food_name, occurredAt, 24),
      preferredServingSizes: upsertServingPreference(nextMemory.preferredServingSizes, item, occurredAt, 24),
    };
  }

  const haystack = [normalizedTitle, input.rawText ?? '', ...input.items.map((item) => `${item.food_name} ${item.source_name ?? ''}`)].join(' ');
  const restaurants = extractKnownMatches(input.items, haystack, knownRestaurants);
  const brands = extractKnownMatches(input.items, haystack, knownBrands);

  for (const restaurant of restaurants) {
    nextMemory = {
      ...nextMemory,
      commonRestaurants: upsertNamedStat(nextMemory.commonRestaurants, restaurant, occurredAt, 12),
    };
  }

  for (const brand of brands) {
    nextMemory = {
      ...nextMemory,
      commonBrands: upsertNamedStat(nextMemory.commonBrands, brand, occurredAt, 12),
    };
  }

  return nextMemory;
}

export function rememberAssistantCorrection(memory: AssistantMemorySnapshot, text: string, occurredAt = new Date().toISOString()): AssistantMemorySnapshot {
  const trimmed = text.trim();
  if (!trimmed) {
    return memory;
  }

  const nextCorrections = [...memory.commonCorrections];
  const index = nextCorrections.findIndex((entry) => normalizeText(entry.text) === normalizeText(trimmed));

  if (index >= 0) {
    nextCorrections[index] = {
      ...nextCorrections[index],
      count: nextCorrections[index].count + 1,
      lastUsedAt: occurredAt,
    };
  } else {
    nextCorrections.push({
      text: trimmed,
      count: 1,
      lastUsedAt: occurredAt,
    });
  }

  return {
    ...memory,
    updatedAt: occurredAt,
    commonCorrections: rankByUsage(nextCorrections).slice(0, 16),
  };
}

export function seedAssistantMemoryFromSavedMeals(input: AssistantMemorySeedInput): AssistantMemorySnapshot {
  let nextMemory = createEmptyAssistantMemory();

  for (const meal of input.favoriteMeals ?? []) {
    if (!meal.items?.length) {
      continue;
    }

    nextMemory = rememberAssistantMeal(nextMemory, {
      title: meal.title,
      rawText: meal.rawText,
      mealType: meal.mealType,
      items: meal.items,
      confidenceScore: meal.confidenceScore ?? 0.82,
      source: 'favorite',
      occurredAt: meal.lastUsedAt ?? new Date().toISOString(),
    });
  }

  for (const meal of input.recentMeals ?? []) {
    if (!meal.items.length) {
      continue;
    }

    nextMemory = rememberAssistantMeal(nextMemory, {
      title: meal.title,
      rawText: meal.rawText,
      mealType: meal.mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      items: meal.items,
      confidenceScore: meal.confidenceScore ?? 0.82,
      source: 'recent',
      occurredAt: meal.date ?? meal.createdAt,
    });
  }

  return nextMemory;
}

export function mergeAssistantMemorySnapshots(base: AssistantMemorySnapshot, seed: AssistantMemorySnapshot | null | undefined): AssistantMemorySnapshot {
  if (!seed) {
    return base;
  }

  let nextMemory = base;
  const existingMealIds = new Set(base.recurringMeals.map((entry) => entry.id));
  const existingCorrections = new Set(base.commonCorrections.map((entry) => normalizeText(entry.text)));

  for (const meal of seed.recurringMeals) {
    if (existingMealIds.has(meal.id) || !meal.items.length) {
      continue;
    }

    existingMealIds.add(meal.id);
    nextMemory = rememberAssistantMeal(nextMemory, {
      title: meal.title,
      rawText: meal.rawText,
      mealType: meal.mealType,
      items: meal.items,
      confidenceScore: meal.confidenceScore,
      source: meal.source,
      occurredAt: meal.lastUsedAt ?? meal.createdAt ?? undefined,
    });
  }

  for (const correction of seed.commonCorrections) {
    const normalized = normalizeText(correction.text);
    if (!normalized || existingCorrections.has(normalized)) {
      continue;
    }

    existingCorrections.add(normalized);
    nextMemory = rememberAssistantCorrection(nextMemory, correction.text, correction.lastUsedAt ?? undefined);
  }

  return nextMemory;
}
