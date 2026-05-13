import { z } from 'zod';

export const parsedFoodItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative().default(0),
  sugar: z.number().nonnegative().default(0),
  sodium: z.number().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  is_trusted: z.boolean().optional(),
  source_type: z.enum(['OFFICIAL_RESTAURANT', 'GENERIC_REFERENCE', 'AI_ESTIMATE']).nullable().optional(),
  source_name: z.string().nullable().optional(),
  catalog_food_id: z.string().nullable().optional(),
});

export const parsedMealResponseSchema = z.object({
  needs_clarification: z.boolean(),
  clarifying_question: z.string().nullable(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence_score: z.number().min(0).max(1),
  items: z.array(parsedFoodItemSchema),
  totals: z.object({
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
    fiber: z.number().nonnegative(),
    sugar: z.number().nonnegative(),
    sodium: z.number().nonnegative(),
  }),
});

export type ParsedFoodItem = z.infer<typeof parsedFoodItemSchema>;
export type ParsedMealResponse = z.infer<typeof parsedMealResponseSchema>;
