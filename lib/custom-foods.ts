import type { ParsedFoodItem } from '@/lib/ai/types';
import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { logWriteFailure, logWriteStart, logWriteSuccess } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';
import { createFavoriteMealTemplate } from '@/lib/reusable-meals';
import { normalizeServingUnit } from '@/lib/food-scaling';

const customFoodPrefix = 'Custom food:';
const customFoodBarcodePrefix = 'Custom food barcode:';

export type CustomFoodInput = {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  sodium?: number | null;
};

export type CustomFoodSummary = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingQuantity: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  createdAt: string | null;
  updatedAt: string | null;
  items: ParsedFoodItem[];
};

type CustomFoodRecord = {
  id: string;
  title: string;
  rawText?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  items: Array<{
    foodName: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    notes?: string | null;
    sourceName?: string | null;
  }>;
};

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeCustomFoodBarcode(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function barcodeNote(barcode?: string | null) {
  const normalized = normalizeCustomFoodBarcode(barcode);
  return normalized ? `${customFoodBarcodePrefix} ${normalized}` : 'Custom food';
}

export function barcodeFromCustomFoodNotes(notes?: string | null) {
  const cleaned = notes?.trim();
  if (!cleaned) return null;
  const index = cleaned.indexOf(customFoodBarcodePrefix);
  if (index < 0) return null;
  return normalizeCustomFoodBarcode(cleaned.slice(index + customFoodBarcodePrefix.length));
}

function sourceNameForBrand(brand?: string | null) {
  const cleaned = brand?.trim();
  return cleaned ? `${customFoodPrefix} ${cleaned}` : customFoodPrefix;
}

function brandFromSourceName(sourceName?: string | null) {
  const cleaned = sourceName?.trim();
  if (!cleaned?.startsWith(customFoodPrefix)) return null;
  return cleaned.slice(customFoodPrefix.length).trim() || null;
}

export function isCustomFoodReusableMeal(record: { rawText?: string | null }) {
  return record.rawText?.trim().startsWith(customFoodPrefix) ?? false;
}

export function buildCustomFoodCreatePayload(input: CustomFoodInput) {
  const name = cleanName(input.name);
  const item: ParsedFoodItem = {
    food_name: name,
    quantity: input.servingQuantity,
    unit: normalizeServingUnit(input.servingUnit),
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber ?? 0,
    sugar: input.sugar ?? 0,
    sodium: input.sodium ?? 0,
    notes: barcodeNote(input.barcode),
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: sourceNameForBrand(input.brand),
    confidence_label: 'Verified',
    catalog_food_id: null,
  };

  return {
    meal_type: 'snack' as const,
    confidence_score: 1,
    raw_text: `${customFoodPrefix} ${name}`,
    items: [item],
  };
}

export function buildCustomFoodSummaryFromReusableMealRecord(record: CustomFoodRecord): CustomFoodSummary {
  const item = record.items[0];
  const parsedItem: ParsedFoodItem = {
    food_name: item?.foodName ?? record.title,
    quantity: item?.quantity ?? 1,
    unit: normalizeServingUnit(item?.unit ?? 'serving'),
    calories: item?.calories ?? 0,
    protein: item?.protein ?? 0,
    carbs: item?.carbs ?? 0,
    fat: item?.fat ?? 0,
    fiber: item?.fiber ?? 0,
    sugar: item?.sugar ?? 0,
    sodium: item?.sodium ?? 0,
    notes: item?.notes ?? 'Custom food',
    source_type: 'GENERIC_REFERENCE',
    source_name: item?.sourceName ?? customFoodPrefix,
    confidence_label: 'Verified',
    is_trusted: true,
    catalog_food_id: null,
  };

  return {
    id: record.id,
    name: parsedItem.food_name,
    brand: brandFromSourceName(item?.sourceName),
    barcode: barcodeFromCustomFoodNotes(item?.notes),
    servingQuantity: parsedItem.quantity,
    servingUnit: parsedItem.unit,
    calories: Math.round(parsedItem.calories),
    protein: Math.round(parsedItem.protein),
    carbs: Math.round(parsedItem.carbs),
    fat: Math.round(parsedItem.fat),
    fiber: Math.round(parsedItem.fiber),
    sugar: Math.round(parsedItem.sugar),
    sodium: Math.round(parsedItem.sodium),
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
    items: [parsedItem],
  };
}

export async function getCustomFoods() {
  if (!hasDatabaseConnectionString()) return [];
  const user = await getCurrentUserWithProfile();
  if (!user) return [];

  const records = await prisma.reusableMeal.findMany({
    where: { userId: user.id, rawText: { startsWith: customFoodPrefix } },
    include: { items: true },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });

  return records.filter(isCustomFoodReusableMeal).map(buildCustomFoodSummaryFromReusableMealRecord);
}

export async function createCustomFood(input: CustomFoodInput) {
  const record = await createFavoriteMealTemplate(buildCustomFoodCreatePayload(input));
  return buildCustomFoodSummaryFromReusableMealRecord(record);
}

export async function deleteCustomFood(customFoodId: string) {
  if (!hasDatabaseConnectionString()) {
    throw new Error('Custom foods need a live backend before they can sync.');
  }
  const user = await getCurrentUserWithProfile();
  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  logWriteStart('custom-food.delete', { userId: user.id, customFoodId });
  try {
    const record = await prisma.reusableMeal.findFirst({
      where: { id: customFoodId, userId: user.id, rawText: { startsWith: customFoodPrefix } },
      select: { id: true },
    });
    if (!record) throw new Error('Custom food not found.');
    await prisma.reusableMeal.delete({ where: { id: record.id } });
    logWriteSuccess('custom-food.delete', { userId: user.id, customFoodId });
  } catch (error) {
    logWriteFailure('custom-food.delete', error, { userId: user.id, customFoodId });
    throw error;
  }
}
