import type { ParsedFoodItem } from '@/lib/ai/types';

export type PublicNutritionLabel = 'Verified' | 'Matched' | 'Estimated' | 'Needs Review';

export type QuickFood = {
  id: string;
  name: string;
  brand: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sourceLabel: PublicNutritionLabel;
  createdAt: string;
  lastUsedAt: string;
  parsedItem: ParsedFoodItem;
};

export type MealTemplate = {
  id: string;
  name: string;
  foods: QuickFood[];
  createdAt: string;
  lastUsedAt: string;
};

export type QuickListsState = {
  favorites: QuickFood[];
  recents: QuickFood[];
  templates: MealTemplate[];
};

export const quickListsStorageKey = 'calorie-compass.quicklists.v1';

function nowIso() {
  return new Date().toISOString();
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function defaultQuickListsState(): QuickListsState {
  return { favorites: [], recents: [], templates: [] };
}

export function normalizeFoodIdentity(input: { name: string; brand?: string | null; unit?: string | null }) {
  const name = input.name.trim().toLowerCase();
  const brand = (input.brand ?? '').trim().toLowerCase();
  const unit = (input.unit ?? '').trim().toLowerCase();
  return `${name}::${brand}::${unit}`;
}

export function buildQuickFoodFromParsedItem(options: {
  item: ParsedFoodItem;
  sourceLabel: PublicNutritionLabel;
  nameOverride?: string;
  brand?: string | null;
  servingQuantity?: number;
  servingUnit?: string;
  createdAt?: string;
  lastUsedAt?: string;
  id?: string;
}): QuickFood {
  const createdAt = options.createdAt ?? nowIso();
  const lastUsedAt = options.lastUsedAt ?? createdAt;

  return {
    id: options.id ?? `qf_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    name: options.nameOverride ?? options.item.food_name,
    brand: options.brand ?? null,
    servingQuantity: options.servingQuantity ?? options.item.quantity ?? 1,
    servingUnit: options.servingUnit ?? options.item.unit ?? 'serving',
    calories: Number(options.item.calories || 0),
    protein: Number(options.item.protein || 0),
    carbs: Number(options.item.carbs || 0),
    fat: Number(options.item.fat || 0),
    sourceLabel: options.sourceLabel,
    createdAt,
    lastUsedAt,
    parsedItem: options.item,
  };
}

export function upsertRecentFood(recents: QuickFood[], food: QuickFood, maxCount = 35) {
  const identity = normalizeFoodIdentity({ name: food.name, brand: food.brand, unit: food.servingUnit });
  const next = recents
    .filter((candidate) => normalizeFoodIdentity({ name: candidate.name, brand: candidate.brand, unit: candidate.servingUnit }) !== identity)
    .slice(0, Math.max(0, maxCount - 1));
  return [{ ...food, lastUsedAt: nowIso() }, ...next];
}

export function toggleFavorite(favorites: QuickFood[], food: QuickFood) {
  const identity = normalizeFoodIdentity({ name: food.name, brand: food.brand, unit: food.servingUnit });
  const existing = favorites.find((candidate) => normalizeFoodIdentity({ name: candidate.name, brand: candidate.brand, unit: candidate.servingUnit }) === identity);
  if (existing) {
    return favorites.filter((candidate) => candidate.id !== existing.id);
  }

  const createdAt = nowIso();
  return [{ ...food, createdAt, lastUsedAt: createdAt }, ...favorites];
}

export function renameTemplate(templates: MealTemplate[], templateId: string, name: string) {
  const nextName = name.trim();
  if (!nextName) return templates;
  return templates.map((template) => (template.id === templateId ? { ...template, name: nextName } : template));
}

export function deleteTemplate(templates: MealTemplate[], templateId: string) {
  return templates.filter((template) => template.id !== templateId);
}

export function touchTemplate(templates: MealTemplate[], templateId: string) {
  const stamped = nowIso();
  return templates
    .map((template) => (template.id === templateId ? { ...template, lastUsedAt: stamped } : template))
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
}

export function createTemplate(templates: MealTemplate[], options: { name: string; foods: QuickFood[] }) {
  const trimmedName = options.name.trim();
  if (!trimmedName || options.foods.length === 0) return templates;
  const stamped = nowIso();
  const template: MealTemplate = {
    id: `tpl_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    name: trimmedName,
    foods: options.foods,
    createdAt: stamped,
    lastUsedAt: stamped,
  };

  return [template, ...templates];
}

export function loadQuickListsFromStorage(storage: Pick<Storage, 'getItem'>): QuickListsState {
  const raw = storage.getItem(quickListsStorageKey);
  if (!raw) return defaultQuickListsState();
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== 'object') return defaultQuickListsState();

  const record = parsed as Record<string, unknown>;
  const favorites = Array.isArray(record.favorites) ? record.favorites : [];
  const recents = Array.isArray(record.recents) ? record.recents : [];
  const templates = Array.isArray(record.templates) ? record.templates : [];

  return {
    favorites: favorites as QuickFood[],
    recents: recents as QuickFood[],
    templates: templates as MealTemplate[],
  };
}

export function saveQuickListsToStorage(storage: Pick<Storage, 'setItem'>, state: QuickListsState) {
  storage.setItem(quickListsStorageKey, JSON.stringify(state));
}
