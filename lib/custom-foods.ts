import type { ParsedFoodItem } from '@/lib/ai/types';
import { getCurrentUserWithProfile, hasDatabaseConnectionString } from '@/lib/current-user';
import { logWriteFailure, logWriteStart, logWriteSuccess } from '@/lib/persistence';
import { prisma } from '@/lib/prisma';
import { createFavoriteMealTemplate } from '@/lib/reusable-meals';

const customFoodPrefix = 'Custom food:';

type CustomFoodInput = {
  name: string;
  brand?: string | null;
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
    sourceName?: string | null;
  }>;
};

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function sourceNameForBrand(brand?: string | null) {
  const cleaned = brand?.trim();
  return cleaned ? `${customFoodPrefix} ${cleaned}` : customFoodPrefix;
}

function brandFromSourceName(sourceName?: string | null) {
  const cleaned = sourceName?.trim();
  if (!cleaned?.startsWith(customFoodPrefix)) return null;
  const brand = cleaned.slice(customFoodPrefix.length).trim();
  return brand || null;
}

export function isCustomFoodReusableMeal(record: { rawText?: string | null }) {
  return record.rawText?.trim().startsWith(customFoodPrefix) ?? false;
}

export function buildCustomFoodCreatePayload(input: CustomFoodInput) {
  const name = cleanName(input.name);
  const item: ParsedFoodItem = {
    food_name: name,
    quantity: input.servingQuantity,
    unit: input.servingUnit.trim(),
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber ?? 0,
    sugar: input.sugar ?? 0,
    sodium: input.sodium ?? 0,
    notes: 'Custom food',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: sourceNameForBrand(input.brand),
    catalog_food_id: null,
  };

  return {
    meal_type: 'snack' as const,
    confidence_score: 1,
    raw_text: `${customFoodPrefix} ${name}`,
    items: [item],
  };
}

export function buildCustomFoodSummaryFromReusableMealRecord(record: CustomFoodRecord) {
  const item = record.items[0];
  return {
    id: record.id,
    name: item?.foodName ?? record.title,
    brand: brandFromSourceName(item?.sourceName),
    servingQuantity: item?.quantity ?? 1,
    servingUnit: item?.unit ?? 'serving',
    calories: Math.round(item?.calories ?? 0),
    protein: Math.round(item?.protein ?? 0),
    carbs: Math.round(item?.carbs ?? 0),
    fat: Math.round(item?.fat ?? 0),
    fiber: Math.round(item?.fiber ?? 0),
    sugar: Math.round(item?.sugar ?? 0),
    sodium: Math.round(item?.sodium ?? 0),
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export async function getCustomFoods() {
  if (!hasDatabaseConnectionString()) {
    return [];
  }

  const user = await getCurrentUserWithProfile();
  if (!user) {
    return [];
  }

  const records = await prisma.reusableMeal.findMany({
    where: {
      userId: user.id,
      rawText: {
        startsWith: customFoodPrefix,
      },
    },
    include: { items: true },
    orderBy: { updatedAt: 'desc' },
    take: 30,
  });

  return records.filter(isCustomFoodReusableMeal).map(buildCustomFoodSummaryFromReusableMealRecord);
}

export async function createCustomFood(input: CustomFoodInput) {
  const payload = buildCustomFoodCreatePayload(input);
  const record = await createFavoriteMealTemplate(payload);
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
      where: {
        id: customFoodId,
        userId: user.id,
        rawText: {
          startsWith: customFoodPrefix,
        },
      },
      select: { id: true },
    });

    if (!record) {
      throw new Error('Custom food not found.');
    }

    await prisma.reusableMeal.delete({ where: { id: record.id } });
    logWriteSuccess('custom-food.delete', { userId: user.id, customFoodId });
  } catch (error) {
    logWriteFailure('custom-food.delete', error, { userId: user.id, customFoodId });
    throw error;
  }
}
