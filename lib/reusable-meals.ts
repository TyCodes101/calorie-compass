import type { ParsedFoodItem } from '@/lib/ai/types';
import { getCurrentUserWithProfile } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';

type MealTypeValue = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type StoredMealType = Uppercase<MealTypeValue>;

type TemplateInput = {
  meal_type: MealTypeValue;
  confidence_score: number;
  raw_text?: string | null;
  items: ParsedFoodItem[];
};

type StoredMealItemLike = {
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
  nutritionSourceType?: ParsedFoodItem['source_type'] | null;
  nutritionSourceName?: string | null;
  catalogFoodId?: string | null;
};

type StoredReusableMealItemLike = {
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
  isTrusted?: boolean;
  sourceType?: ParsedFoodItem['source_type'] | null;
  sourceName?: string | null;
  catalogFoodId?: string | null;
};

export type LoggerDraft = {
  title: string;
  rawText: string;
  mealType: MealTypeValue;
  confidenceScore: number;
  items: ParsedFoodItem[];
  sourceReusableMealId: string | null;
};

function titleFromMeal(rawText: string | null | undefined, mealType: MealTypeValue) {
  const trimmed = rawText?.trim();
  if (trimmed) return trimmed;
  return `${mealType[0]?.toUpperCase() ?? ''}${mealType.slice(1)} meal`;
}

function toStoredMealType(mealType: MealTypeValue): StoredMealType {
  return mealType.toUpperCase() as StoredMealType;
}

function toDraftMealType(mealType: string): MealTypeValue {
  return mealType.toLowerCase() as MealTypeValue;
}

function isReusableMealItemLike(item: StoredMealItemLike | StoredReusableMealItemLike): item is StoredReusableMealItemLike {
  return 'sourceType' in item || 'sourceName' in item || 'isTrusted' in item;
}

function toParsedFoodItem(item: StoredMealItemLike | StoredReusableMealItemLike): ParsedFoodItem {
  const sourceType = isReusableMealItemLike(item) ? item.sourceType : item.nutritionSourceType;
  const sourceName = isReusableMealItemLike(item) ? item.sourceName : item.nutritionSourceName;
  const isTrusted = isReusableMealItemLike(item) ? item.isTrusted : sourceType !== 'AI_ESTIMATE';

  return {
    food_name: item.foodName,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
    sugar: item.sugar,
    sodium: item.sodium,
    notes: item.notes ?? null,
    is_trusted: Boolean(isTrusted),
    source_type: sourceType ?? null,
    source_name: sourceName ?? null,
    catalog_food_id: item.catalogFoodId ?? null,
  };
}

export function buildReusableMealTemplateInput(payload: TemplateInput) {
  return {
    title: titleFromMeal(payload.raw_text, payload.meal_type),
    mealType: toStoredMealType(payload.meal_type),
    rawText: payload.raw_text?.trim() ?? null,
    confidenceScore: payload.confidence_score,
    items: payload.items.map((item) => ({
      foodName: item.food_name,
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      notes: item.notes ?? null,
      isTrusted: Boolean(item.is_trusted),
      sourceType: item.source_type ?? null,
      sourceName: item.source_name ?? null,
      catalogFoodId: item.catalog_food_id ?? null,
    })),
  };
}

export function buildLoggerDraftFromMealRecord(record: {
  id: string;
  mealType: string;
  rawText?: string | null;
  confidenceScore?: number | null;
  items: StoredMealItemLike[];
}): LoggerDraft {
  const mealType = toDraftMealType(record.mealType);

  return {
    title: titleFromMeal(record.rawText, mealType),
    rawText: record.rawText?.trim() || titleFromMeal(record.rawText, mealType),
    mealType,
    confidenceScore: record.confidenceScore ?? 0.82,
    items: record.items.map(toParsedFoodItem),
    sourceReusableMealId: null,
  };
}

export function buildLoggerDraftFromReusableMealRecord(record: {
  id: string;
  title: string;
  mealType: string;
  rawText?: string | null;
  confidenceScore?: number | null;
  items: StoredReusableMealItemLike[];
}): LoggerDraft {
  const mealType = toDraftMealType(record.mealType);

  return {
    title: record.title,
    rawText: record.rawText?.trim() || record.title,
    mealType,
    confidenceScore: record.confidenceScore ?? 0.82,
    items: record.items.map(toParsedFoodItem),
    sourceReusableMealId: record.id,
  };
}

export async function getLoggerDraft(options: { mealId?: string | null; reusableMealId?: string | null }) {
  const user = await getCurrentUserWithProfile();
  if (!user) {
    return null;
  }

  if (options.reusableMealId) {
    const reusableMeal = await prisma.reusableMeal.findFirst({
      where: {
        id: options.reusableMealId,
        userId: user.id,
      },
      include: { items: true },
    });

    if (reusableMeal) {
      return buildLoggerDraftFromReusableMealRecord(reusableMeal);
    }
  }

  if (options.mealId) {
    const meal = await prisma.meal.findFirst({
      where: {
        id: options.mealId,
        userId: user.id,
      },
      include: { items: true },
    });

    if (meal) {
      return buildLoggerDraftFromMealRecord(meal);
    }
  }

  return null;
}

export async function createFavoriteMealTemplate(payload: TemplateInput & { reusable_meal_id?: string | null }) {
  const user = await getCurrentUserWithProfile();
  if (!user) {
    throw new Error('No user found. Complete onboarding first.');
  }

  const template = buildReusableMealTemplateInput(payload);

  if (payload.reusable_meal_id) {
    const existing = await prisma.reusableMeal.findFirst({
      where: {
        id: payload.reusable_meal_id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Favorite meal not found.');
    }

    return prisma.reusableMeal.update({
      where: { id: existing.id },
      data: {
        title: template.title,
        rawText: template.rawText,
        mealType: template.mealType,
        confidenceScore: template.confidenceScore,
        isFavorite: true,
        items: {
          deleteMany: {},
          create: template.items,
        },
      },
      include: { items: true },
    });
  }

  return prisma.reusableMeal.create({
    data: {
      userId: user.id,
      title: template.title,
      rawText: template.rawText,
      mealType: template.mealType,
      confidenceScore: template.confidenceScore,
      isFavorite: true,
      items: {
        create: template.items,
      },
    },
    include: { items: true },
  });
}

export async function markReusableMealUsed(reusableMealId: string | null | undefined) {
  if (!reusableMealId) {
    return;
  }

  const user = await getCurrentUserWithProfile();
  if (!user) {
    return;
  }

  await prisma.reusableMeal.updateMany({
    where: {
      id: reusableMealId,
      userId: user.id,
    },
    data: {
      lastUsedAt: new Date(),
    },
  });
}

export async function getFavoriteMeals() {
  const user = await getCurrentUserWithProfile();
  if (!user) {
    return [];
  }

  const favorites = await prisma.reusableMeal.findMany({
    where: {
      userId: user.id,
      isFavorite: true,
    },
    include: { items: true },
    orderBy: [{ lastUsedAt: 'desc' }, { updatedAt: 'desc' }],
    take: 8,
  });

  return favorites.map((favorite) => ({
    id: favorite.id,
    title: favorite.title,
    rawText: favorite.rawText,
    mealType: favorite.mealType.toLowerCase() as MealTypeValue,
    lastUsedAt: favorite.lastUsedAt?.toISOString() ?? null,
    totalCalories: Math.round(favorite.items.reduce((sum, item) => sum + item.calories, 0)),
    itemCount: favorite.items.length,
    trustedCount: favorite.items.filter((item) => item.isTrusted && item.sourceType !== 'AI_ESTIMATE').length,
  }));
}
