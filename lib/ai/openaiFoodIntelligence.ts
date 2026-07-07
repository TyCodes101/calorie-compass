import OpenAI from 'openai';
import { z } from 'zod';

import {
  type MealAssistantModelOutput,
  type MealAssistantRequest,
  mealAssistantModelOutputSchema,
} from '@/lib/ai/mealAssistantSchema';
import { getOpenAIFoodIntelligenceTimeoutMs, getServerOpenAIApiKey, openaiMealModel } from '@/lib/ai/openaiConfig';

const MAX_OUTPUT_ITEMS = 12;
const MAX_MODIFIERS = 12;
const MAX_CANDIDATE_QUERIES = 8;
const MAX_MUST_NOT_MATCH = 8;
const MAX_RAW_TEXT_LENGTH = 240;
const MAX_NAME_LENGTH = 180;
const MAX_NOTE_LENGTH = 360;
const MAX_INPUT_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_TEXT_LENGTH = 1200;
const MAX_CONTEXT_ITEM_NAME_LENGTH = 180;
const MAX_MEMORY_TITLE_LENGTH = 120;

const boundedString = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const nullableBoundedString = (maxLength: number) => boundedString(maxLength).nullable();

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
  text: boundedString(MAX_NAME_LENGTH),
  target: nullableBoundedString(MAX_NAME_LENGTH),
}).strict();

const foodIntelligenceQuantitySchema = z.object({
  amount: z.number().positive().nullable(),
  unit: nullableBoundedString(48),
  servingText: nullableBoundedString(96),
}).strict();

const foodIntelligenceExpectedIdentitySchema = z.object({
  restaurant: nullableBoundedString(MAX_NAME_LENGTH),
  brand: nullableBoundedString(MAX_NAME_LENGTH),
  canonicalItem: nullableBoundedString(MAX_NAME_LENGTH),
  mustNotMatch: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_MUST_NOT_MATCH),
}).strict();

const foodIntelligenceNutritionExpectationSchema = z.object({
  shouldBeZeroCalorieDrink: z.boolean(),
  shouldScaleWithQuantity: z.boolean(),
  shouldBeFootlong: z.boolean(),
  shouldBeNoCheese: z.boolean(),
  shouldBeEstimateOnly: z.boolean(),
}).strict();

const foodIntelligenceItemSchema = z.object({
  rawText: boundedString(MAX_RAW_TEXT_LENGTH),
  normalizedName: boundedString(MAX_NAME_LENGTH),
  brandOrRestaurant: nullableBoundedString(MAX_NAME_LENGTH),
  foodType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown']),
  quantity: foodIntelligenceQuantitySchema.nullable(),
  modifiers: z.array(foodIntelligenceModifierSchema).max(MAX_MODIFIERS),
  candidateQueries: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_CANDIDATE_QUERIES),
  expectedIdentity: foodIntelligenceExpectedIdentitySchema.nullable(),
  nutritionExpectation: foodIntelligenceNutritionExpectationSchema.nullable(),
}).strict();

export const foodIntelligenceResultSchema = z.object({
  action: foodIntelligenceActionSchema,
  confidence: z.number().min(0).max(1),
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    reason: nullableBoundedString(MAX_NOTE_LENGTH),
    clarificationQuestion: nullableBoundedString(MAX_NOTE_LENGTH),
  }).strict(),
  items: z.array(foodIntelligenceItemSchema).max(MAX_OUTPUT_ITEMS),
  userFacingMessage: nullableBoundedString(MAX_NOTE_LENGTH),
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
          reason: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
          clarificationQuestion: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
        },
      },
      items: {
        type: 'array',
        maxItems: MAX_OUTPUT_ITEMS,
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
            rawText: { type: 'string', maxLength: MAX_RAW_TEXT_LENGTH },
            normalizedName: { type: 'string', maxLength: MAX_NAME_LENGTH },
            brandOrRestaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
            foodType: { enum: ['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown'] },
            quantity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['amount', 'unit', 'servingText'],
              properties: {
                amount: { type: ['number', 'null'], exclusiveMinimum: 0 },
                unit: { type: ['string', 'null'], maxLength: 48 },
                servingText: { type: ['string', 'null'], maxLength: 96 },
              },
            },
            modifiers: {
              type: 'array',
              maxItems: MAX_MODIFIERS,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'text', 'target'],
                properties: {
                  type: { enum: ['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'size', 'serving'] },
                  text: { type: 'string', maxLength: MAX_NAME_LENGTH },
                  target: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                },
              },
            },
            candidateQueries: {
              type: 'array',
              maxItems: MAX_CANDIDATE_QUERIES,
              items: { type: 'string', maxLength: MAX_NAME_LENGTH },
            },
            expectedIdentity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['restaurant', 'brand', 'canonicalItem', 'mustNotMatch'],
              properties: {
                restaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                brand: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                canonicalItem: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
                mustNotMatch: {
                  type: 'array',
                  maxItems: MAX_MUST_NOT_MATCH,
                  items: { type: 'string', maxLength: MAX_NAME_LENGTH },
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
      userFacingMessage: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
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

const unsafeKeyRegex = /^(?:calories|protein|carbs?|fat|fiber|sugar|sodium|source[_-]?type|source[_-]?name|is[_-]?trusted|confidence[_-]?label|provider[_-]?used|macro(?:s)?|totals?)$/i;
const promptInjectionTextRegex = /\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions?\b|\b(?:system|developer)\s+prompt\b|\bOPENAI_API_KEY\b|\bsk-[A-Za-z0-9_-]{8,}\b/i;
const unsafeTrustClaimRegex = /\b(?:mark(?:ed)?|label(?:ed)?|set)\s+(?:this\s+)?(?:as\s+)?(?:verified|trusted)\b|\b(?:verified|trusted)\s+(?:even\s+)?without\s+(?:a\s+)?source\b/i;
const unsafeNutritionClaimRegex = /\b\d+(?:\.\d+)?\s*(?:calories?|kcal)\b|\b\d+(?:\.\d+)?\s*g\s+(?:protein|carbs?|fat)\b/i;

function hasUnsafeModelOutput(value: unknown, path: string[] = []): boolean {
  if (Array.isArray(value)) {
    return value.some((item, index) => hasUnsafeModelOutput(item, [...path, String(index)]));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).some(([key, child]) => {
      if (unsafeKeyRegex.test(key)) {
        return true;
      }
      return hasUnsafeModelOutput(child, [...path, key]);
    });
  }

  if (typeof value !== 'string') {
    return false;
  }

  if (promptInjectionTextRegex.test(value) || unsafeTrustClaimRegex.test(value)) {
    return true;
  }

  const lastPath = path[path.length - 1] ?? '';
  return ['userFacingMessage', 'reason', 'clarificationQuestion'].includes(lastPath)
    && unsafeNutritionClaimRegex.test(value);
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

  if (hasUnsafeModelOutput(parsed)) {
    return { ok: false, reason: 'unsafe_schema' };
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
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new FoodIntelligenceTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function truncateText(text: string | null | undefined, maxLength: number) {
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
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
          latest_user_message: truncateText(input.message, MAX_INPUT_MESSAGE_LENGTH),
          state: {
            mealType: input.state.mealType,
            hasPendingMeal: Boolean(input.state.pendingMeal),
            pendingMealStatus: input.state.pendingMeal?.status ?? null,
            currentMealText: truncateText(input.state.currentMealText, MAX_CONTEXT_TEXT_LENGTH),
            currentMealItems: input.state.currentMealItems.slice(0, MAX_OUTPUT_ITEMS).map((item) => ({
              food_name: truncateText(item.food_name, MAX_CONTEXT_ITEM_NAME_LENGTH),
              quantity: item.quantity,
              unit: truncateText(item.unit, 48),
              source_type: item.source_type ?? null,
              confidence_label: item.confidence_label ?? null,
            })),
            pendingClarification: input.state.pendingClarification ?? null,
            saved: input.state.saved,
          },
          context: {
            favoriteMeals: input.context?.favoriteMeals?.slice(0, 5).map((meal) => truncateText(meal.title, MAX_MEMORY_TITLE_LENGTH)) ?? [],
            recentMeals: input.context?.recentMeals?.slice(0, 5).map((meal) => truncateText(meal.title, MAX_MEMORY_TITLE_LENGTH)) ?? [],
            nutritionPreferences: truncateText(input.context?.nutritionPreferences, MAX_CONTEXT_TEXT_LENGTH),
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
  const decisionItems = mutatesMeal && !shouldClarify ? items : [];
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
    contains_food_to_log: decisionItems.length > 0 && mutatesMeal,
    contains_quantity_update: mutatesMeal && !shouldClarify && parsed.items.some((item) => item.nutritionExpectation?.shouldScaleWithQuantity === true),
    should_mutate_pending_meal: mutatesMeal && !shouldClarify,
    items: decisionItems,
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
