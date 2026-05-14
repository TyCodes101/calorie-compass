import { z } from 'zod';

import { assistantMemorySchema } from '@/lib/assistant-memory';
import { parsedFoodItemSchema } from '@/lib/ai/types';

export const mealAssistantIntentSchema = z.enum([
  'greeting',
  'new_food_item',
  'add_to_current_meal',
  'correction',
  'quantity_change',
  'remove_item',
  'clarification_answer',
  'save_meal',
  'start_new_meal',
  'repeat_meal',
  'nutrition_guidance',
  'macro_question',
  'recommendation_request',
  'meal_review',
  'edit_command',
  'delete_command',
  'comparison_question',
  'goal_question',
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
  lastAssistantReply: z.string().nullable().optional(),
  activeTopic: z.enum(['meal', 'nutrition', 'recommendation', 'casual', 'clarification', 'review', 'off_topic']).nullable().optional(),
  activeMode: z.enum(['casual_conversation', 'logging_mode', 'meal_building', 'nutrition_coaching', 'macro_discussion', 'recommendation_mode', 'correction_mode', 'review_save']).nullable().optional(),
  activeQuestion: z.string().nullable().optional(),
  previousIntent: mealAssistantIntentSchema.nullable().optional(),
  previousUserMessage: z.string().nullable().optional(),
});

export const mealAssistantMemoryMealSchema = z.object({
  id: z.string(),
  title: z.string(),
  rawText: z.string().nullable().default(null),
  mealType: mealAssistantMealTypeSchema,
  totalCalories: z.number().nonnegative().default(0),
  confidenceScore: z.number().min(0).max(1).default(0.82),
  sourceReusableMealId: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  lastUsedAt: z.string().nullable().optional(),
  items: z.array(parsedFoodItemSchema).default([]),
});

export const mealAssistantContextSchema = z.object({
  favoriteMeals: z.array(mealAssistantMemoryMealSchema).default([]),
  recentMeals: z.array(mealAssistantMemoryMealSchema).default([]),
  assistantMemory: assistantMemorySchema.optional(),
  nutritionPreferences: z.string().nullable().default(null),
  proteinGoal: z.number().nullable().optional(),
  dailyCalorieGoal: z.number().nullable().optional(),
  todayProtein: z.number().nullable().optional(),
  todayCarbs: z.number().nullable().optional(),
  todayFat: z.number().nullable().optional(),
  todayCalories: z.number().nullable().optional(),
  remainingProtein: z.number().nullable().optional(),
  remainingCarbs: z.number().nullable().optional(),
  remainingFat: z.number().nullable().optional(),
  remainingCalories: z.number().nullable().optional(),
  todayMealCount: z.number().nullable().optional(),
});

export const mealAssistantRequestSchema = z.object({
  message: z.string().min(1),
  state: mealAssistantStateSchema,
  context: mealAssistantContextSchema.optional(),
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
export type MealAssistantMemoryMeal = z.infer<typeof mealAssistantMemoryMealSchema>;
export type MealAssistantContext = z.infer<typeof mealAssistantContextSchema>;
export type MealAssistantRequest = z.infer<typeof mealAssistantRequestSchema>;
export type MealAssistantResponse = z.infer<typeof mealAssistantResponseSchema>;
