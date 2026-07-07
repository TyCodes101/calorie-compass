import OpenAI from 'openai';
import { z } from 'zod';

import {
  type MealAssistantModelOutput,
  type MealAssistantRequest,
  mealAssistantModelOutputSchema,
} from '@/lib/ai/mealAssistantSchema';
import { getOpenAIFoodIntelligenceTimeoutMs, getServerOpenAIApiKey, openaiMealModel } from '@/lib/ai/openaiConfig';

export const foodIntelligenceActionSchema = z.enum([
  'create_pending_meal',
  'add_to_pending_meal',
  'replace_pending_meal',
  'remove_from_pending_meal',
  'answer_pending_macros',
  'confirm_save',
  'cancel_pending_meal',
  'undo',
  'ask_clarification',
  'no_op',
]);

const foodIntelligenceModifierSchema = z.object({
  type: z.enum(['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving']),
  text: z.string().min(1),
  target: z.string().min(1).nullable().default(null),
}).strict();

const foodIntelligenceQuantitySchema = z.object({
  amount: z.number().positive().nullable().default(null),
  unit: z.string().min(1).nullable().default(null),
  servingText: z.string().min(1).nullable().default(null),
}).strict();

const foodIntelligenceExpectedIdentitySchema = z.object({
  restaurant: z.string().min(1).nullable().default(null),
  brand: z.string().min(1).nullable().default(null),
  canonicalItem: z.string().min(1).nullable().default(null),
  mustNotMatch: z.array(z.string().min(1)).default([]),
}).strict();

const foodIntelligenceNutritionExpectationSchema = z.object({
  shouldBeZeroCalorieDrink: z.boolean().default(false),
  shouldScaleWithQuantity: z.boolean().default(false),
  shouldBeFootlong: z.boolean().default(false),
  shouldBeNoCheese: z.boolean().default(false),
  shouldBeEstimateOnly: z.boolean().default(false),
}).strict();

const foodIntelligenceItemSchema = z.object({
  rawText: z.string().min(1),
  normalizedName: z.string().min(1),
  brandOrRestaurant: z.string().min(1).nullable().default(null),
  foodType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown']),
  quantity: foodIntelligenceQuantitySchema.nullable().default(null),
  modifiers: z.array(foodIntelligenceModifierSchema).default([]),
  candidateQueries: z.array(z.string().min(1)).default([]),
  expectedIdentity: foodIntelligenceExpectedIdentitySchema.nullable().default(null),
  nutritionExpectation: foodIntelligenceNutritionExpectationSchema.nullable().default(null),
}).strict();

export const foodIntelligenceResultSchema = z.object({
  action: foodIntelligenceActionSchema,
  confidence: z.number().min(0).max(1),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    reason: z.string().min(1).nullable().default(null),
    clarificationQuestion: z.string().min(1).nullable().default(null),
  }).strict(),
  items: z.array(foodIntelligenceItemSchema).default([]),
  userFacingMessage: z.string().min(1).nullable().default(null),
}).strict();

export type FoodIntelligenceResult = z.infer<typeof foodIntelligenceResultSchema>;
export type FoodIntelligenceFailureReason =
  | 'missing_api_key'
  | 'client_unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'openai_error'
  | 'empty_output'
  | 'invalid_json'
  | 'schema_invalid'
  | 'unsafe_schema';

export type FoodIntelligenceOutcome =
  | { ok: true; value: FoodIntelligenceResult; model: string }
  | { ok: false; reason: FoodIntelligenceFailureReason };

type ChatCompletionLike = {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  }>;
};

type CreateChatCompletion = (
  params: Record<string, unknown>,
  options?: { signal?: AbortSignal },
) => Promise<ChatCompletionLike>;

export type OpenAIFoodIntelligenceDependencies = {
  apiKey?: string | null;
  model?: string;
  timeoutMs?: number;
  createChatCompletion?: CreateChatCompletion;
};

export const foodIntelligenceSystemPrompt = [
  'You are the Calorie Compass food intelligence parser.',
  'You are not the nutrition database. You parse intent and identity only.',
  'Return structured JSON only. Do not include calories, macros, source_type, is_trusted, or save decisions outside the schema.',
  'Never save meals. Never bypass review. Confirmation means intent only; the app state machine decides whether saving is allowed.',
  'Preserve restaurant, brand, item identity, quantities, serving sizes, and modifiers exactly.',
  'Be conservative with confidence. Ambiguous foods should ask clarification.',
  'If nutrition is not source-backed, mark intent so the existing resolver can create a reviewable estimate.',
  'Wendy Baconator or Baconnator must stay Wendy Baconator and must not become chicken.',
  'McDouble no cheese must stay McDonald\'s McDouble with no-cheese expectation.',
  'Subway meatball footlong must stay Subway and footlong.',
  'Chipotle chicken bowl must preserve Chipotle identity.',
  'Diet Coke and Coke Zero should carry zero/low calorie drink expectation.',
  'Hot Cheetos, Quest chips, and Fairlife shakes must preserve brand identity when clear.',
  'Chicken sandwich, bowl, burger, and breakfast sandwich without brand/source details are ambiguous.',
  'Commands: yes/save it/confirm means confirm_save only when a pending meal exists; where are my macros answers macros; add appends; replace with replaces; nvm/cancel/start over cancels.',
].join('\n');

const responseJsonSchema = {
  name: 'food_intelligence_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'confidence', 'ambiguity', 'items', 'userFacingMessage'],
    properties: {
      action: { enum: foodIntelligenceActionSchema.options },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      ambiguity: {
        type: 'object',
        additionalProperties: false,
        required: ['isAmbiguous', 'reason', 'clarificationQuestion'],
        properties: {
          isAmbiguous: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
          clarificationQuestion: { type: ['string', 'null'] },
        },
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'rawText',
            'normalizedName',
            'brandOrRestaurant',
            'foodType',
            'quantity',
            'modifiers',
            'candidateQueries',
            'expectedIdentity',
            'nutritionExpectation',
          ],
          properties: {
            rawText: { type: 'string' },
            normalizedName: { type: 'string' },
            brandOrRestaurant: { type: ['string', 'null'] },
            foodType: { enum: ['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown'] },
            quantity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['amount', 'unit', 'servingText'],
              properties: {
                amount: { type: ['number', 'null'], exclusiveMinimum: 0 },
                unit: { type: ['string', 'null'] },
                servingText: { type: ['string', 'null'] },
              },
            },
            modifiers: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'text', 'target'],
                properties: {
                  type: { enum: ['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving'] },
                  text: { type: 'string' },
                  target: { type: ['string', 'null'] },
                },
              },
            },
            candidateQueries: {
              type: 'array',
              items: { type: 'string' },
            },
            expectedIdentity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['restaurant', 'brand', 'canonicalItem', 'mustNotMatch'],
              properties: {
                restaurant: { type: ['string', 'null'] },
                brand: { type: ['string', 'null'] },
                canonicalItem: { type: ['string', 'null'] },
                mustNotMatch: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            nutritionExpectation: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: [
                'shouldBeZeroCalorieDrink',
                'shouldScaleWithQuantity',
                'shouldBeFootlong',
                'shouldBeNoCheese',
                'shouldBeEstimateOnly',
              ],
              properties: {
                shouldBeZeroCalorieDrink: { type: 'boolean' },
                shouldScaleWithQuantity: { type: 'boolean' },
                shouldBeFootlong: { type: 'boolean' },
                shouldBeNoCheese: { type: 'boolean' },
                shouldBeEstimateOnly: { type: 'boolean' },
              },
            },
          },
        },
      },
      userFacingMessage: { type: ['string', 'null'] },
    },
  },
} as const;

class FoodIntelligenceTimeoutError extends Error {
  constructor() {
    super('OpenAI food intelligence timed out.');
    this.name = 'FoodIntelligenceTimeoutError';
  }
}

function getFailureReason(error: unknown): FoodIntelligenceFailureReason {
  if (error instanceof FoodIntelligenceTimeoutError) {
    return 'timeout';
  }

  if (typeof error === 'object' && error !== null) {
    const maybeStatus = 'status' in error ? Number((error as { status?: unknown }).status) : null;
    const maybeCode = 'code' in error ? String((error as { code?: unknown }).code) : '';
    if (maybeStatus === 429 || /rate/i.test(maybeCode)) {
      return 'rate_limited';
    }
  }

  return 'openai_error';
}

function parseFoodIntelligenceContent(content: string): FoodIntelligenceOutcome {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty_output' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const result = foodIntelligenceResultSchema.safeParse(parsed);
  if (!result.success) {
    const hasUnsafeNutritionKeys = JSON.stringify(parsed).match(/\b(?:calories|protein|carbs|fat|source_type|is_trusted|confidence_label)\b/i);
    return { ok: false, reason: hasUnsafeNutritionKeys ? 'unsafe_schema' : 'schema_invalid' };
  }

  return { ok: true, value: result.data, model: openaiMealModel };
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new FoodIntelligenceTimeoutError());
    }, timeoutMs);
  });

  return Promise.race([operation(controller.signal), timeout]);
}

function buildCompletionPayload(input: MealAssistantRequest, model: string) {
  return {
    model,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: responseJsonSchema,
    },
    messages: [
      {
        role: 'system',
        content: foodIntelligenceSystemPrompt,
      },
      ...((input.conversationHistory ?? []).slice(-10).map((message) => ({
        role: message.role,
        content: message.text.slice(0, 1200),
      }))),
      {
        role: 'user',
        content: JSON.stringify({
          latest_user_message: input.message,
          state: {
            mealType: input.state.mealType,
            hasPendingMeal: Boolean(input.state.pendingMeal),
            pendingMealStatus: input.state.pendingMeal?.status ?? null,
            currentMealText: input.state.currentMealText ?? null,
            currentMealItems: input.state.currentMealItems.map((item) => ({
              food_name: item.food_name,
              quantity: item.quantity,
              unit: item.unit,
              source_type: item.source_type ?? null,
              confidence_label: item.confidence_label ?? null,
            })),
            pendingClarification: input.state.pendingClarification ?? null,
            saved: input.state.saved,
          },
          context: {
            favoriteMeals: input.context?.favoriteMeals?.slice(0, 5).map((meal) => meal.title) ?? [],
            recentMeals: input.context?.recentMeals?.slice(0, 5).map((meal) => meal.title) ?? [],
            nutritionPreferences: input.context?.nutritionPreferences ?? null,
          },
        }),
      },
    ],
  };
}

export async function runOpenAIFoodIntelligence(
  input: MealAssistantRequest,
  dependencies: OpenAIFoodIntelligenceDependencies = {},
): Promise<FoodIntelligenceOutcome> {
  if (typeof window !== 'undefined' && !dependencies.createChatCompletion) {
    return { ok: false, reason: 'client_unavailable' };
  }

  const apiKey = dependencies.apiKey === undefined ? getServerOpenAIApiKey() : dependencies.apiKey;
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const model = dependencies.model ?? openaiMealModel;
  const createChatCompletion = dependencies.createChatCompletion ?? (async (params, options) => {
    const client = new OpenAI({ apiKey });
    return client.chat.completions.create(params as never, options as never) as Promise<ChatCompletionLike>;
  });

  try {
    const completion = await withTimeout(
      (signal) => createChatCompletion(buildCompletionPayload(input, model), { signal }),
      dependencies.timeoutMs ?? getOpenAIFoodIntelligenceTimeoutMs(),
    );
    const content = completion.choices?.[0]?.message?.content ?? '';
    const parsed = parseFoodIntelligenceContent(content);
    return parsed.ok ? { ...parsed, model } : parsed;
  } catch (error) {
    return { ok: false, reason: getFailureReason(error) };
  }
}

function toAssistantConfidence(confidence: number): MealAssistantModelOutput['confidence'] {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'low';
}

function buildItemName(item: FoodIntelligenceResult['items'][number]) {
  const primaryCandidate = item.candidateQueries.find((query) => query.trim())?.trim();
  return primaryCandidate || item.normalizedName;
}

function buildModifierTexts(item: FoodIntelligenceResult['items'][number]) {
  return [
    ...item.modifiers.map((modifier) => [modifier.type, modifier.text, modifier.target].filter(Boolean).join(': ')),
    item.expectedIdentity?.canonicalItem ? `expected item: ${item.expectedIdentity.canonicalItem}` : null,
    item.expectedIdentity?.restaurant ? `expected restaurant: ${item.expectedIdentity.restaurant}` : null,
    item.expectedIdentity?.brand ? `expected brand: ${item.expectedIdentity.brand}` : null,
    item.nutritionExpectation?.shouldBeNoCheese ? 'no cheese' : null,
    item.nutritionExpectation?.shouldBeFootlong ? 'footlong' : null,
    item.nutritionExpectation?.shouldBeZeroCalorieDrink ? 'zero calorie drink' : null,
  ].filter((value): value is string => Boolean(value));
}

export function mapFoodIntelligenceToMealAssistantDecision(
  result: FoodIntelligenceResult,
  message: string,
): MealAssistantModelOutput {
  const parsed = foodIntelligenceResultSchema.parse(result);
  const shouldClarify = parsed.action === 'ask_clarification' || parsed.ambiguity.isAmbiguous || parsed.confidence < 0.45;
  const itemAction = parsed.action === 'replace_pending_meal'
    ? 'replace'
    : parsed.action === 'remove_from_pending_meal'
      ? 'remove'
      : parsed.action === 'cancel_pending_meal' || parsed.action === 'undo' || parsed.action === 'no_op'
        ? 'update'
        : 'add';
  const items = parsed.items.map((item) => ({
    name: buildItemName(item),
    brand: item.brandOrRestaurant ?? item.expectedIdentity?.restaurant ?? item.expectedIdentity?.brand ?? null,
    quantity: item.quantity?.amount ?? 1,
    unit: item.quantity?.unit ?? item.quantity?.servingText ?? null,
    modifiers: buildModifierTexts(item),
    action: itemAction,
  }));

  const mutatesMeal = ['create_pending_meal', 'add_to_pending_meal', 'replace_pending_meal', 'remove_from_pending_meal'].includes(parsed.action);
  const actionMap: Record<FoodIntelligenceResult['action'], MealAssistantModelOutput['intent']> = {
    create_pending_meal: 'new_food_item',
    add_to_pending_meal: 'add_to_current_meal',
    replace_pending_meal: 'correction',
    remove_from_pending_meal: 'remove_item',
    answer_pending_macros: 'macro_question',
    confirm_save: 'save_meal',
    cancel_pending_meal: 'start_new_meal',
    undo: 'start_new_meal',
    ask_clarification: 'unknown',
    no_op: 'unknown',
  };
  const assistantActionMap: Record<FoodIntelligenceResult['action'], MealAssistantModelOutput['action']> = {
    create_pending_meal: 'add_food',
    add_to_pending_meal: 'add_food',
    replace_pending_meal: 'update_item_name',
    remove_from_pending_meal: 'remove_item',
    answer_pending_macros: 'answer_question',
    confirm_save: 'save_meal',
    cancel_pending_meal: 'unclear',
    undo: 'unclear',
    ask_clarification: 'unclear',
    no_op: 'unclear',
  };

  return mealAssistantModelOutputSchema.parse({
    intent: shouldClarify ? 'unknown' : actionMap[parsed.action],
    action: shouldClarify ? 'unclear' : assistantActionMap[parsed.action],
    assistant_reply: parsed.userFacingMessage ?? parsed.ambiguity.clarificationQuestion ?? 'Got it.',
    contains_food_to_log: items.length > 0 && mutatesMeal,
    contains_quantity_update: parsed.items.some((item) => item.nutritionExpectation?.shouldScaleWithQuantity === true),
    should_mutate_pending_meal: mutatesMeal && !shouldClarify,
    items: shouldClarify ? [] : items,
    corrections: parsed.action === 'replace_pending_meal'
      ? [{ target: 'pending meal', change: message }]
      : [],
    should_lookup_nutrition: mutatesMeal && !shouldClarify && items.length > 0,
    should_save_meal: parsed.action === 'confirm_save' && !shouldClarify,
    should_ask_clarification: shouldClarify,
    clarification_question: shouldClarify
      ? parsed.ambiguity.clarificationQuestion ?? 'Which exact food and serving should I use?'
      : null,
    confidence: toAssistantConfidence(parsed.confidence),
  });
}
