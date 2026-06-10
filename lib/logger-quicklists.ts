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
const quickListsExportVersion = 1;
const publicNutritionLabels: PublicNutritionLabel[] = ['Verified', 'Matched', 'Estimated', 'Needs Review'];

type QuickListsExportKind = 'favorites' | 'templates';

type QuickListsImportResult =
  | { ok: true; kind: 'favorites'; items: QuickFood[] }
  | { ok: true; kind: 'templates'; items: MealTemplate[] }
  | { ok: false; error: string };

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

function searchText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isParsedFoodItem(value: unknown): value is ParsedFoodItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.food_name === 'string' &&
    isFiniteNumber(value.quantity) &&
    typeof value.unit === 'string' &&
    isFiniteNumber(value.calories) &&
    isFiniteNumber(value.protein) &&
    isFiniteNumber(value.carbs) &&
    isFiniteNumber(value.fat)
  );
}

function isQuickFood(value: unknown): value is QuickFood {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.brand === null || typeof value.brand === 'string') &&
    isFiniteNumber(value.servingQuantity) &&
    typeof value.servingUnit === 'string' &&
    isFiniteNumber(value.calories) &&
    isFiniteNumber(value.protein) &&
    isFiniteNumber(value.carbs) &&
    isFiniteNumber(value.fat) &&
    typeof value.sourceLabel === 'string' &&
    publicNutritionLabels.includes(value.sourceLabel as PublicNutritionLabel) &&
    typeof value.createdAt === 'string' &&
    typeof value.lastUsedAt === 'string' &&
    isParsedFoodItem(value.parsedItem)
  );
}

function isMealTemplate(value: unknown): value is MealTemplate {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.foods) &&
    value.foods.every(isQuickFood) &&
    typeof value.createdAt === 'string' &&
    typeof value.lastUsedAt === 'string'
  );
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

export function filterQuickFoods(foods: QuickFood[], query: string) {
  const normalized = searchText(query);
  if (!normalized) return foods;
  return foods.filter((food) => `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(normalized));
}

export function filterMealTemplates(templates: MealTemplate[], query: string) {
  const normalized = searchText(query);
  if (!normalized) return templates;
  return templates.filter((template) => template.name.toLowerCase().includes(normalized));
}

export function validateTemplateName(templates: MealTemplate[], name: string, currentTemplateId?: string | null) {
  const nextName = name.trim();
  if (!nextName) return 'Template name is required.';
  const duplicate = templates.some(
    (template) =>
      template.id !== currentTemplateId &&
      template.name.trim().toLowerCase() === nextName.toLowerCase(),
  );
  return duplicate ? 'A template with that name already exists.' : null;
}

export function renameTemplate(templates: MealTemplate[], templateId: string, name: string) {
  const nextName = name.trim();
  if (validateTemplateName(templates, nextName, templateId)) return templates;
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
  if (validateTemplateName(templates, trimmedName) || options.foods.length === 0) return templates;
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

export function buildQuickListsExport(kind: QuickListsExportKind, items: QuickFood[] | MealTemplate[], exportedAt = nowIso()) {
  return JSON.stringify(
    {
      version: quickListsExportVersion,
      kind,
      exportedAt,
      items,
    },
    null,
    2,
  );
}

export function importQuickListsJson(kind: QuickListsExportKind, raw: string): QuickListsImportResult {
  const parsed = safeParseJson(raw);
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Choose a valid MacroMesh quicklist JSON file.' };
  }

  if (parsed.version !== quickListsExportVersion || parsed.kind !== kind || !Array.isArray(parsed.items)) {
    return { ok: false, error: 'That file does not match this quicklist type.' };
  }

  if (kind === 'favorites') {
    if (!parsed.items.every(isQuickFood)) {
      return { ok: false, error: 'Favorites import contains invalid foods.' };
    }
    return { ok: true, kind, items: parsed.items };
  }

  if (!parsed.items.every(isMealTemplate)) {
    return { ok: false, error: 'Templates import contains invalid meals.' };
  }

  const names = new Set<string>();
  for (const template of parsed.items) {
    const normalized = template.name.trim().toLowerCase();
    if (!normalized || names.has(normalized)) {
      return { ok: false, error: 'Templates import contains duplicate or unnamed templates.' };
    }
    names.add(normalized);
  }

  return { ok: true, kind, items: parsed.items };
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
