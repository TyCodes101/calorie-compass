import { z } from 'zod';

const verificationLabelSchema = z.enum(['Verified', 'Matched', 'Estimated', 'Needs Review']);

const nutritionValuesSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
});

const nutritionBasisSchema = z.object({
  type: z.enum(['per_100g', 'per_serving', 'per_unit', 'as_provided']),
  provider_quantity: z.number().positive(),
  provider_unit: z.string().min(1),
  provider_weight_grams: z.number().positive().nullable().optional(),
  scale_factor: z.number().positive(),
  base_nutrition: nutritionValuesSchema,
});

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
  confidence_label: verificationLabelSchema.nullable().optional(),
  match_type: z.enum(['exact_branded', 'exact_restaurant', 'fuzzy_branded', 'fuzzy_restaurant', 'verified_database', 'generic_estimate', 'ai_estimate', 'unknown']).nullable().optional(),
  matched_query: z.string().nullable().optional(),
  original_user_text: z.string().nullable().optional(),
  provider_used: z.string().nullable().optional(),
  used_ai_fallback: z.boolean().nullable().optional(),
  catalog_food_id: z.string().nullable().optional(),
  userQuantity: z.number().nonnegative().nullable().optional(),
  userUnit: z.string().nullable().optional(),
  userTextSpan: z.string().nullable().optional(),
  normalizedGrams: z.number().nonnegative().nullable().optional(),
  normalizedOunces: z.number().nonnegative().nullable().optional(),
  sourceId: z.string().nullable().optional(),
  providerCandidateId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  requested_modifiers: z.array(z.string()).optional(),
  modifier_resolution: z.enum(['official_component', 'deterministic_database', 'estimated', 'unresolved']).nullable().optional(),
  review_status: z.enum(['none', 'recommended', 'required']).nullable().optional(),
  nutrition_basis: nutritionBasisSchema.nullable().optional(),
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
