import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { normalizeParsedMealResponse } from '@/lib/ai/normalize';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';

type GoldenMode = 'lookup' | 'assistant';

export type GoldenNutritionCase = {
  id: string;
  prompt: string;
  mode: GoldenMode;
  expectClarification?: boolean;
  expectedNames?: string[];
  forbiddenNames?: string[];
  calories?: { min: number; max: number };
  protein?: { min: number; max: number };
  expectedLabels?: Array<'Verified' | 'Matched' | 'Estimated' | 'Needs Review'>;
};

export type GoldenNutritionResult = {
  id: string;
  prompt: string;
  passed: boolean;
  actualIdentity: string;
  actualCalories: number;
  actualProtein: number;
  issues: string[];
};

export type GoldenNutritionValidation = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: GoldenNutritionResult[];
};

export const goldenNutritionCases: GoldenNutritionCase[] = [
  {
    id: 'quest-bbq-protein-chips',
    prompt: 'Quest BBQ Protein Chips',
    mode: 'lookup',
    expectedNames: ['Quest', 'BBQ', 'Protein Chips'],
    forbiddenNames: ['Potato chips'],
    calories: { min: 130, max: 150 },
    protein: { min: 18, max: 20 },
    expectedLabels: ['Verified'],
  },
  {
    id: 'mcdouble',
    prompt: 'McDouble',
    mode: 'lookup',
    expectedNames: ['McDouble'],
    forbiddenNames: ['Generic hamburger'],
    calories: { min: 380, max: 400 },
    protein: { min: 20, max: 24 },
    expectedLabels: ['Verified'],
  },
  {
    id: 'coke-zero',
    prompt: 'Coke Zero',
    mode: 'lookup',
    expectedNames: ['Coke Zero'],
    forbiddenNames: ['Classic', 'Regular'],
    calories: { min: 0, max: 5 },
    protein: { min: 0, max: 1 },
    expectedLabels: ['Verified'],
  },
  {
    id: 'skittles-pack',
    prompt: 'Skittles pack',
    mode: 'assistant',
    expectedNames: ['Skittles'],
    forbiddenNames: ['Snickers'],
    calories: { min: 230, max: 270 },
    protein: { min: 0, max: 3 },
  },
  {
    id: 'fairlife-core-power-elite',
    prompt: 'Fairlife Core Power Elite 42g shake',
    mode: 'lookup',
    expectedNames: ['Fairlife', 'Core Power', '42g'],
    forbiddenNames: ['Whole milk'],
    calories: { min: 220, max: 240 },
    protein: { min: 41, max: 43 },
    expectedLabels: ['Verified'],
  },
  {
    id: 'chipotle-chicken-bowl',
    prompt: 'Chipotle chicken bowl',
    mode: 'assistant',
    expectedNames: ['Chipotle', 'chicken', 'bowl'],
    calories: { min: 500, max: 1100 },
    protein: { min: 40, max: 75 },
  },
  {
    id: 'large-baked-potato',
    prompt: 'large baked potato',
    mode: 'assistant',
    expectedNames: ['Potato'],
    calories: { min: 220, max: 380 },
    protein: { min: 4, max: 10 },
  },
  {
    id: 'eggs-and-toast',
    prompt: '2 eggs and toast',
    mode: 'assistant',
    expectedNames: ['Eggs', 'Toast'],
    calories: { min: 220, max: 360 },
    protein: { min: 15, max: 25 },
  },
  {
    id: 'eight-oz-chicken-breast',
    prompt: '8 oz chicken breast',
    mode: 'assistant',
    expectedNames: ['Chicken'],
    calories: { min: 250, max: 430 },
    protein: { min: 45, max: 75 },
  },
  {
    id: 'generic-chips-clarification',
    prompt: 'chips',
    mode: 'lookup',
    expectClarification: true,
  },
  {
    id: 'protein-shake-clarification',
    prompt: 'protein shake',
    mode: 'lookup',
    expectClarification: true,
  },
];

function buildState(): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'snack',
    userName: 'Reliability Audit',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
  };
}

function identity(items: ParsedFoodItem[]) {
  return items.map((item) => item.food_name).join(', ');
}

function totals(items: ParsedFoodItem[]) {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
    }),
    { calories: 0, protein: 0 },
  );
}

async function resolveCase(testCase: GoldenNutritionCase): Promise<ParsedMealResponse> {
  if (testCase.mode === 'lookup') {
    return await lookupNutrition({ text: testCase.prompt, mealType: 'snack' }) ?? {
      needs_clarification: true,
      clarifying_question: 'No nutrition result found.',
      meal_type: 'snack',
      confidence_score: 0.2,
      items: [],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    };
  }

  const response = await runMealAssistant({ message: testCase.prompt, state: buildState() });
  return normalizeParsedMealResponse({
    needs_clarification: response.should_ask_clarification,
    clarifying_question: response.clarification_question,
    meal_type: 'snack',
    confidence_score: response.meal.confidence_score,
    items: response.meal.items,
    totals: response.meal.totals,
  });
}

function validateCase(testCase: GoldenNutritionCase, response: ParsedMealResponse): GoldenNutritionResult {
  const items = response.items;
  const itemIdentity = identity(items);
  const nutrition = totals(items);
  const haystack = itemIdentity.toLowerCase();
  const issues: string[] = [];

  if (testCase.expectClarification) {
    if (!response.needs_clarification || items.length > 0) issues.push('expected_clarification');
  } else {
    if (response.needs_clarification) issues.push('unexpected_clarification');
    if (!items.length) issues.push('missing_items');
  }

  for (const expectedName of testCase.expectedNames ?? []) {
    if (!haystack.includes(expectedName.toLowerCase())) issues.push(`missing_name:${expectedName}`);
  }

  for (const forbiddenName of testCase.forbiddenNames ?? []) {
    if (haystack.includes(forbiddenName.toLowerCase())) issues.push(`forbidden_name:${forbiddenName}`);
  }

  if (testCase.calories && (nutrition.calories < testCase.calories.min || nutrition.calories > testCase.calories.max)) {
    issues.push(`calories_out_of_range:${nutrition.calories}`);
  }

  if (testCase.protein && (nutrition.protein < testCase.protein.min || nutrition.protein > testCase.protein.max)) {
    issues.push(`protein_out_of_range:${nutrition.protein}`);
  }

  if (testCase.expectedLabels?.length) {
    const labels = new Set(items.map((item) => item.confidence_label).filter(Boolean));
    if (![...labels].some((label) => testCase.expectedLabels?.includes(label as never))) {
      issues.push(`verification_label:${[...labels].join(',') || 'missing'}`);
    }
  }

  return {
    id: testCase.id,
    prompt: testCase.prompt,
    passed: issues.length === 0,
    actualIdentity: itemIdentity,
    actualCalories: Math.round(nutrition.calories * 100) / 100,
    actualProtein: Math.round(nutrition.protein * 100) / 100,
    issues,
  };
}

export async function runGoldenNutritionValidation(cases = goldenNutritionCases): Promise<GoldenNutritionValidation> {
  const results: GoldenNutritionResult[] = [];

  for (const testCase of cases) {
    results.push(validateCase(testCase, await resolveCase(testCase)));
  }

  const passed = results.filter((result) => result.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 0,
    results,
  };
}
