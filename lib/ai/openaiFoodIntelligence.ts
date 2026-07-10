import OpenAI from 'openai';
import { z } from 'zod';

import {
  type MealAssistantModelOutput,
  type MealAssistantRequest,
  mealAssistantModelOutputSchema,
} from '@/lib/ai/mealAssistantSchema';
import { getOpenAIFoodIntelligenceTimeoutMs, getOpenAIMealModel, getServerOpenAIApiKey } from '@/lib/ai/openaiConfig';

const MAX_OUTPUT_ITEMS = 12;
const MAX_MODIFIERS = 12;
const MAX_CANDIDATE_QUERIES = 8;
const MAX_MUST_NOT_MATCH = 8;
const MAX_MUST_INCLUDE = 10;
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
  type: z.enum(['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'portion', 'size', 'serving']),
  text: boundedString(MAX_NAME_LENGTH),
  target: nullableBoundedString(MAX_NAME_LENGTH),
}).strict();

const foodIntelligenceQuantitySchema = z.preprocess((value) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const quantity = value as { amount?: unknown; unit?: unknown; naturalUnit?: unknown; servingText?: unknown };
  const unit = typeof quantity.unit === 'string'
    ? quantity.unit
    : typeof quantity.naturalUnit === 'string'
      ? quantity.naturalUnit
      : null;
  const amount = typeof quantity.amount === 'number' ? quantity.amount : null;
  const servingText = typeof quantity.servingText === 'string'
    ? quantity.servingText
    : amount && unit
      ? `${amount} ${unit}`
      : null;

  return {
    ...quantity,
    unit,
    naturalUnit: typeof quantity.naturalUnit === 'string' ? quantity.naturalUnit : null,
    servingText,
  };
}, z.object({
  amount: z.number().positive().nullable(),
  unit: nullableBoundedString(48),
  naturalUnit: nullableBoundedString(48),
  servingText: nullableBoundedString(96),
}).strict());

const foodIntelligenceMealContextSchema = z.object({
  restaurant: nullableBoundedString(MAX_NAME_LENGTH),
  brand: nullableBoundedString(MAX_NAME_LENGTH),
  mealName: nullableBoundedString(MAX_NAME_LENGTH),
  mealType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'mixed', 'unknown']).nullable(),
}).strict();

const foodIntelligenceServingDefaultSchema = z.object({
  amount: z.number().positive(),
  unit: boundedString(48),
  reason: boundedString(MAX_NOTE_LENGTH),
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

function uniqueNonEmpty(values: Array<string | null | undefined>, max = MAX_CANDIDATE_QUERIES) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
    if (output.length >= max) break;
  }
  return output;
}

function inferFoodType(args: {
  foodType?: unknown;
  restaurant?: unknown;
  brand?: unknown;
  category?: unknown;
  mealContextType?: unknown;
}) {
  if (typeof args.foodType === 'string') {
    return args.foodType;
  }
  if (typeof args.restaurant === 'string' && args.restaurant.trim()) {
    return 'restaurant';
  }
  const category = typeof args.category === 'string' ? args.category.toLowerCase() : '';
  if (/\b(?:drink|soda|beverage)\b/.test(category)) {
    return 'drink';
  }
  if (typeof args.brand === 'string' && args.brand.trim()) {
    return 'branded';
  }
  if (args.mealContextType === 'homemade') {
    return 'homemade';
  }
  return 'generic';
}

function normalizeFoodIntelligenceOutput(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }

  const output = value as {
    mealContext?: {
      restaurant?: unknown;
      brand?: unknown;
      mealName?: unknown;
      mealType?: unknown;
    };
    items?: unknown;
  };
  const mealContext = output.mealContext ?? {};
  const contextRestaurant = typeof mealContext.restaurant === 'string' ? mealContext.restaurant : null;
  const contextBrand = typeof mealContext.brand === 'string' ? mealContext.brand : null;
  const contextMealType = typeof mealContext.mealType === 'string' ? mealContext.mealType : null;

  const items = Array.isArray(output.items)
    ? output.items.map((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          return item;
        }

        const inputItem = item as Record<string, unknown>;
        const canonicalName = typeof inputItem.canonicalName === 'string'
          ? inputItem.canonicalName
          : typeof inputItem.normalizedName === 'string'
            ? inputItem.normalizedName
            : typeof inputItem.rawText === 'string'
              ? inputItem.rawText
              : '';
        const restaurant = typeof inputItem.restaurant === 'string' ? inputItem.restaurant : contextRestaurant;
        const brand = typeof inputItem.brand === 'string' ? inputItem.brand : contextBrand;
        const brandOrRestaurant = typeof inputItem.brandOrRestaurant === 'string'
          ? inputItem.brandOrRestaurant
          : restaurant ?? brand;
        const quantity = inputItem.quantity;
        const quantityUnit = typeof quantity === 'object' && quantity !== null && !Array.isArray(quantity)
          ? (quantity as { unit?: unknown; naturalUnit?: unknown }).unit ?? (quantity as { naturalUnit?: unknown }).naturalUnit
          : null;
        const servingDefault = typeof inputItem.servingDefault === 'object' && inputItem.servingDefault !== null && !Array.isArray(inputItem.servingDefault)
          ? inputItem.servingDefault
          : {
              amount: 1,
              unit: typeof quantityUnit === 'string' && quantityUnit.trim() ? quantityUnit : 'serving',
              reason: 'Default natural serving for this decomposed item.',
            };
        const mustNotMatch = Array.isArray(inputItem.mustNotMatchTerms)
          ? inputItem.mustNotMatchTerms
          : typeof inputItem.expectedIdentity === 'object' && inputItem.expectedIdentity !== null && !Array.isArray(inputItem.expectedIdentity)
            ? (inputItem.expectedIdentity as { mustNotMatch?: unknown }).mustNotMatch
            : [];
        const category = typeof inputItem.category === 'string' ? inputItem.category : '';

        return {
          ...inputItem,
          canonicalName,
          restaurant,
          brand,
          category: inputItem.category ?? null,
          normalizedName: inputItem.normalizedName ?? canonicalName,
          brandOrRestaurant,
          foodType: inferFoodType({
            foodType: inputItem.foodType,
            restaurant,
            brand,
            category,
            mealContextType: contextMealType,
          }),
          servingDefault,
          candidateQueries: Array.isArray(inputItem.candidateQueries)
            ? inputItem.candidateQueries
            : uniqueNonEmpty([
                brandOrRestaurant ? `${brandOrRestaurant} ${canonicalName}` : null,
                canonicalName,
                typeof inputItem.rawText === 'string' ? inputItem.rawText : null,
              ]),
          expectedIdentity: inputItem.expectedIdentity ?? {
            restaurant,
            brand,
            canonicalItem: canonicalName,
            mustNotMatch: Array.isArray(mustNotMatch) ? mustNotMatch : [],
          },
          nutritionExpectation: inputItem.nutritionExpectation ?? {
            shouldBeZeroCalorieDrink: /\b(?:diet|zero|zero sugar)\b/i.test(`${canonicalName} ${category}`),
            shouldScaleWithQuantity: Boolean(
              typeof quantity === 'object'
                && quantity !== null
                && !Array.isArray(quantity)
                && typeof (quantity as { amount?: unknown }).amount === 'number'
                && (quantity as { amount: number }).amount !== 1,
            ),
            shouldBeFootlong: /\bfootlong\b/i.test(`${canonicalName} ${inputItem.rawText ?? ''}`),
            shouldBeNoCheese: /\b(?:no|without)\s+cheese\b/i.test(`${canonicalName} ${inputItem.rawText ?? ''}`),
            shouldBeEstimateOnly: contextMealType === 'generic' || contextMealType === 'homemade',
          },
          mustIncludeTerms: Array.isArray(inputItem.mustIncludeTerms) ? inputItem.mustIncludeTerms : [canonicalName],
          mustNotMatchTerms: Array.isArray(inputItem.mustNotMatchTerms) ? inputItem.mustNotMatchTerms : Array.isArray(mustNotMatch) ? mustNotMatch : [],
          confidence: typeof inputItem.confidence === 'number' ? inputItem.confidence : 0.82,
          needsClarification: typeof inputItem.needsClarification === 'boolean' ? inputItem.needsClarification : false,
          clarificationQuestion: typeof inputItem.clarificationQuestion === 'string' ? inputItem.clarificationQuestion : null,
        };
      })
    : output.items;

  return {
    ...output,
    mealContext: {
      restaurant: contextRestaurant,
      brand: contextBrand,
      mealName: typeof mealContext.mealName === 'string' ? mealContext.mealName : null,
      mealType: contextMealType,
    },
    items,
  };
}

const foodIntelligenceItemSchema = z.object({
  rawText: boundedString(MAX_RAW_TEXT_LENGTH),
  canonicalName: boundedString(MAX_NAME_LENGTH),
  normalizedName: boundedString(MAX_NAME_LENGTH),
  brandOrRestaurant: nullableBoundedString(MAX_NAME_LENGTH),
  restaurant: nullableBoundedString(MAX_NAME_LENGTH),
  brand: nullableBoundedString(MAX_NAME_LENGTH),
  category: nullableBoundedString(MAX_NAME_LENGTH),
  foodType: z.enum(['restaurant', 'branded', 'generic', 'homemade', 'drink', 'unknown']),
  quantity: foodIntelligenceQuantitySchema.nullable(),
  servingDefault: foodIntelligenceServingDefaultSchema,
  modifiers: z.array(foodIntelligenceModifierSchema).max(MAX_MODIFIERS),
  mustIncludeTerms: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_MUST_INCLUDE),
  mustNotMatchTerms: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_MUST_NOT_MATCH),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: nullableBoundedString(MAX_NOTE_LENGTH),
  candidateQueries: z.array(boundedString(MAX_NAME_LENGTH)).max(MAX_CANDIDATE_QUERIES),
  expectedIdentity: foodIntelligenceExpectedIdentitySchema.nullable(),
  nutritionExpectation: foodIntelligenceNutritionExpectationSchema.nullable(),
}).strict();

export const foodIntelligenceResultSchema = z.preprocess(normalizeFoodIntelligenceOutput, z.object({
  action: foodIntelligenceActionSchema,
  confidence: z.number().min(0).max(1),
  mealContext: foodIntelligenceMealContextSchema,
  ambiguity: z.object({
    isAmbiguous: z.boolean(),
    reason: nullableBoundedString(MAX_NOTE_LENGTH),
    clarificationQuestion: nullableBoundedString(MAX_NOTE_LENGTH),
  }).strict(),
  items: z.array(foodIntelligenceItemSchema).max(MAX_OUTPUT_ITEMS),
  userFacingMessage: nullableBoundedString(MAX_NOTE_LENGTH),
}).strict());

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
  'You are the Calorie Compass meal decomposition parser.',
  'Your first job is to break the latest user message into a structured meal made of separate food components.',
  'You are not the nutrition database. You parse intent, identity, quantities, units, context, and modifiers only.',
  'Return structured JSON only. Do not include calories, macros, source_type, is_trusted, or save decisions outside the schema.',
  'Never save meals. Never bypass review. Confirmation means intent only; the app state machine decides whether saving is allowed.',
  'Preserve restaurant, brand, item identity, quantities, serving sizes, and modifiers exactly on every item.',
  'Do not collapse multiple foods into one item. Split foods connected by commas, and, with, plus, topped with, cooked in, combo labels, and restaurant plate labels.',
  'If the user says a combo or plate such as Panda Express bigger plate, keep the mealContext mealName and emit each selected entree/side separately.',
  'Be conservative with confidence. Ambiguous foods should ask clarification.',
  'If nutrition is not source-backed, mark intent so the existing resolver can create a reviewable estimate.',
  'For restaurant foods, prefer natural serving defaults such as 1 burger, 1 sandwich, 1 taco, 1 burrito, 1 bowl, 1 footlong, 1 6-inch sub, or 1 drink. Do not default obvious restaurant items to 100g.',
  'Wendy Baconator or Baconnator must stay Wendy Baconator and must not become chicken.',
  'McDouble no cheese must stay McDonald\'s McDouble with no-cheese expectation.',
  'Subway meatball footlong must stay Subway and footlong.',
  'Chipotle chicken bowl must preserve Chipotle identity.',
  'Chipotle double chicken means the chicken quantity is already specified; do not ask how much chicken.',
  'Diet Coke and Coke Zero should carry zero/low calorie drink expectation.',
  'Diet Coke must not match NOS, Monster, energy drinks, or unrelated sugar-free beverages.',
  'Trader Joe\'s sugar free gummy worms must stay Trader Joe\'s gummy candy and must not become cookies.',
  'Whole eggs must not become egg whites unless the user explicitly says egg whites.',
  'Hot Cheetos, Quest chips, and Fairlife shakes must preserve brand identity when clear.',
  'Chicken sandwich, bowl, burger, and breakfast sandwich without brand/source details are ambiguous.',
  'Commands: yes/save it/confirm means confirm_save only when a pending meal exists; where are my macros answers macros; add appends; replace with replaces; nvm/cancel/start over cancels.',
].join('\n');

const responseJsonSchema = {
  name: 'meal_decomposition_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['action', 'confidence', 'mealContext', 'ambiguity', 'items', 'userFacingMessage'],
    properties: {
      action: { enum: foodIntelligenceActionSchema.options },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      mealContext: {
        type: 'object',
        additionalProperties: false,
        required: ['restaurant', 'brand', 'mealName', 'mealType'],
        properties: {
          restaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
          brand: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
          mealName: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
          mealType: { enum: ['restaurant', 'branded', 'generic', 'homemade', 'mixed', 'unknown', null] },
        },
      },
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
            'canonicalName',
            'restaurant',
            'brand',
            'category',
            'quantity',
            'servingDefault',
            'modifiers',
            'mustIncludeTerms',
            'mustNotMatchTerms',
            'confidence',
            'needsClarification',
            'clarificationQuestion',
          ],
          properties: {
            rawText: { type: 'string', maxLength: MAX_RAW_TEXT_LENGTH },
            canonicalName: { type: 'string', maxLength: MAX_NAME_LENGTH },
            restaurant: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
            brand: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
            category: { type: ['string', 'null'], maxLength: MAX_NAME_LENGTH },
            quantity: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['amount', 'unit', 'naturalUnit'],
              properties: {
                amount: { type: ['number', 'null'], exclusiveMinimum: 0 },
                unit: { type: ['string', 'null'], maxLength: 48 },
                naturalUnit: { type: ['string', 'null'], maxLength: 48 },
              },
            },
            servingDefault: {
              type: 'object',
              additionalProperties: false,
              required: ['amount', 'unit', 'reason'],
              properties: {
                amount: { type: 'number', exclusiveMinimum: 0 },
                unit: { type: 'string', maxLength: 48 },
                reason: { type: 'string', maxLength: MAX_NOTE_LENGTH },
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
                  type: { enum: ['remove', 'add', 'extra', 'light', 'substitute', 'preparation', 'portion', 'size'] },
                  text: { type: 'string', maxLength: MAX_NAME_LENGTH },
                  target: { type: 'string', maxLength: MAX_NAME_LENGTH },
                },
              },
            },
            mustIncludeTerms: {
              type: 'array',
              maxItems: MAX_MUST_INCLUDE,
              items: { type: 'string', maxLength: MAX_NAME_LENGTH },
            },
            mustNotMatchTerms: {
              type: 'array',
              maxItems: MAX_MUST_NOT_MATCH,
              items: { type: 'string', maxLength: MAX_NAME_LENGTH },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            needsClarification: { type: 'boolean' },
            clarificationQuestion: { type: ['string', 'null'], maxLength: MAX_NOTE_LENGTH },
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

  return { ok: true, value: result.data, model: getOpenAIMealModel().name };
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

  const model = dependencies.model ?? getOpenAIMealModel().name;
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
  if (!item.restaurant && !item.brand && primaryCandidate && primaryCandidate !== item.canonicalName) {
    return primaryCandidate;
  }

  return item.canonicalName || item.normalizedName || primaryCandidate || item.rawText;
}

function buildModifierTexts(item: FoodIntelligenceResult['items'][number]) {
  return [
    ...item.modifiers.map((modifier) => [modifier.type, modifier.text, modifier.target].filter(Boolean).join(': ')),
    ...item.mustIncludeTerms.map((term) => `must include: ${term}`),
    ...item.mustNotMatchTerms.map((term) => `must not match: ${term}`),
    item.servingDefault ? `serving default: ${item.servingDefault.amount} ${item.servingDefault.unit}` : null,
    item.restaurant ? `expected restaurant: ${item.restaurant}` : null,
    item.brand ? `expected brand: ${item.brand}` : null,
    item.category ? `expected category: ${item.category}` : null,
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
  const itemClarification = parsed.items.find((item) => item.needsClarification && item.clarificationQuestion);
  const shouldClarify = parsed.action === 'ask_clarification'
    || parsed.ambiguity.isAmbiguous
    || parsed.confidence < 0.45
    || Boolean(itemClarification);
  const itemAction = parsed.action === 'replace_pending_meal'
    ? 'replace'
    : parsed.action === 'remove_from_pending_meal'
      ? 'remove'
      : parsed.action === 'cancel_pending_meal' || parsed.action === 'undo' || parsed.action === 'no_op'
        ? 'update'
        : 'add';
  const items = parsed.items.map((item) => ({
    name: buildItemName(item),
    brand: item.brandOrRestaurant
      ?? item.restaurant
      ?? item.brand
      ?? item.expectedIdentity?.restaurant
      ?? item.expectedIdentity?.brand
      ?? parsed.mealContext.restaurant
      ?? parsed.mealContext.brand
      ?? null,
    quantity: item.quantity?.amount ?? item.servingDefault.amount ?? 1,
    unit: item.quantity?.unit
      ?? item.quantity?.naturalUnit
      ?? item.quantity?.servingText
      ?? item.servingDefault.unit
      ?? null,
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
      ? itemClarification?.clarificationQuestion ?? parsed.ambiguity.clarificationQuestion ?? 'Which exact food and serving should I use?'
      : null,
    confidence: toAssistantConfidence(parsed.confidence),
  });
}
