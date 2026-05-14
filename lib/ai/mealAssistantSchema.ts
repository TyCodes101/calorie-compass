import { z } from 'zod';

import { parsedFoodItemSchema } from '@/lib/ai/types';

export const mealAssistantIntentSchema = z.enum([
  'new_food_item',
  'add_to_current_meal',
  'correction',
  'quantity_change',
  'remove_item',
  'clarification_answer',
  'save_meal',
  'start_new_meal',
  'casual_message',
  'unknown',
]);

export const mealAssistantItemActionSchema = z.enum(['add', 'update', 'remove', 'replace']);

export const mealAssistantItemSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable(),
  quantity: z.number().positive(),
  unit: z.string().nullable(),
  modifiers: z.array(z.string()).default([]),
  action: mealAssistantItemActionSchema,
});

export const mealAssistantCorrectionSchema = z.object({
  target: z.string().min(1),
  change: z.string().min(1),
});

export const mealAssistantModelOutputSchema = z.object({
  intent: mealAssistantIntentSchema,
  assistant_reply: z.string().min(1),
  items: z.array(mealAssistantItemSchema).default([]),
  corrections: z.array(mealAssistantCorrectionSchema).default([]),
  should_lookup_nutrition: z.boolean(),
  should_save_meal: z.boolean(),
  should_ask_clarification: z.boolean(),
  clarification_question: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const mealAssistantMealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const mealAssistantStateSchema = z.object({
  currentMealItems: z.array(parsedFoodItemSchema).default([]),
  pendingClarification: z.string().nullable().default(null),
  lastAssistantQuestion: z.string().nullable().default(null),
  userCorrections: z.array(z.string()).default([]),
  saved: z.boolean().default(false),
  mealType: mealAssistantMealTypeSchema.default('snack'),
  userName: z.string().nullable().default(null),
  currentMealText: z.string().nullable().default(null),
  confidenceScore: z.number().min(0).max(1).default(0.82),
  sourceReusableMealId: z.string().nullable().optional(),
  editingMealId: z.string().nullable().optional(),
});

export const mealAssistantRequestSchema = z.object({
  message: z.string().min(1),
  state: mealAssistantStateSchema,
});

const nutritionTotalsSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
});

export const mealAssistantResponseSchema = mealAssistantModelOutputSchema.extend({
  meal: z.object({
    items: z.array(parsedFoodItemSchema),
    totals: nutritionTotalsSchema,
    confidence_score: z.number().min(0).max(1),
  }),
  next_state: mealAssistantStateSchema,
});

export type MealAssistantIntent = z.infer<typeof mealAssistantIntentSchema>;
export type MealAssistantItemAction = z.infer<typeof mealAssistantItemActionSchema>;
export type MealAssistantItem = z.infer<typeof mealAssistantItemSchema>;
export type MealAssistantCorrection = z.infer<typeof mealAssistantCorrectionSchema>;
export type MealAssistantModelOutput = z.infer<typeof mealAssistantModelOutputSchema>;
export type MealAssistantState = z.infer<typeof mealAssistantStateSchema>;
export type MealAssistantRequest = z.infer<typeof mealAssistantRequestSchema>;
export type MealAssistantResponse = z.infer<typeof mealAssistantResponseSchema>;
