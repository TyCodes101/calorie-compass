import OpenAI from 'openai';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { parseMealText } from '@/lib/ai/openai';
import { mealAssistantSystemPrompt } from '@/lib/ai/mealAssistantSystemPrompt';
import {
  type MealAssistantItem,
  type MealAssistantModelOutput,
  type MealAssistantResponse,
  type MealAssistantState,
  mealAssistantModelOutputSchema,
} from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { saveConfirmedMeal, updateSavedMeal } from '@/lib/meals';
import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';

const model = process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';
const continuationRegex = /^(and|also|plus|with)\b/i;
const removeRegex = /^(?:remove|without|no|hold the|skip the)\s+(.+)$/i;
const startNewRegex = /^(?:start over|new meal|clear this|reset|fresh one|different meal)\b/i;
const saveRegex = /^(?:save(?: it| that| this)?|log(?: it| that| this)?|done)\b/i;
const quantityOnlyRegex = /^(?:actually|make that|update that to|it was|that was|no)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const directQuantityRegex = /^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const casualRegex = /^(?:hi|hello|hey|yo|sup|what(?:'|’)??s up|thanks|thank you|cool|okay|ok|nice|lol|how are you|how(?:'|’)??s your day)\b/i;
const offTopicRegex = /\b(?:weather|movie|music|homework|code|browser|news|sports|joke)\b/i;

type MealAssistantRunInput = {
  message: string;
  state: MealAssistantState;
  userPreferences?: string | null;
};

type NutritionResolver = (args: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) => Promise<ParsedMealResponse | null>;
type ModelClassifier = (args: MealAssistantRunInput) => Promise<MealAssistantModelOutput>;
type SaveExecutor = (args: { state: MealAssistantState; items: ParsedFoodItem[] }) => Promise<void>;

type MealAssistantDependencies = {
  classify?: ModelClassifier;
  resolveItemNutrition?: NutritionResolver;
  saveMeal?: SaveExecutor;
};

function sumTotals(items: ParsedFoodItem[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      fiber: acc.fiber + Number(item.fiber || 0),
      sugar: acc.sugar + Number(item.sugar || 0),
      sodium: acc.sodium + Number(item.sodium || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCount(value: string) {
  const normalized = value.trim().toLowerCase();
  const wordMap: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  if (wordMap[normalized] !== undefined) {
    return wordMap[normalized];
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function buildItemLookupText(item: MealAssistantItem) {
  const prefix = item.quantity > 1 ? `${item.quantity} ` : item.quantity === 1 ? '1 ' : '';
  const brand = item.brand?.trim() ? `${item.brand.trim()} ` : '';
  const modifiers = item.modifiers.length ? `${item.modifiers.join(' ')} ` : '';
  const unit = item.unit?.trim() ? ` ${item.unit.trim()}` : '';
  return `${prefix}${brand}${modifiers}${item.name}${unit}`.replace(/\s+/g, ' ').trim();
}

function buildMealTextFromItems(items: ParsedFoodItem[]) {
  return items.map((item) => `${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)} ${item.food_name}`).join(', ');
}

function getConfidenceScore(items: ParsedFoodItem[]) {
  if (!items.length) {
    return 0.82;
  }

  if (items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    return 0.98;
  }

  if (items.every((item) => item.is_trusted && item.source_type !== 'AI_ESTIMATE')) {
    return 0.95;
  }

  if (items.some((item) => item.source_type === 'AI_ESTIMATE')) {
    return items.some((item) => item.is_trusted) ? 0.84 : 0.72;
  }

  return 0.9;
}

function getSourceLabel(item: ParsedFoodItem) {
  if (item.source_type === 'OFFICIAL_RESTAURANT') {
    return 'Verified match';
  }

  const sourceName = item.source_name?.toLowerCase() ?? '';
  if (sourceName.includes('usda')) {
    return 'USDA match';
  }

  if (item.source_type === 'GENERIC_REFERENCE' && item.source_name && !sourceName.includes('generic')) {
    return 'Branded database match';
  }

  if (item.source_type === 'AI_ESTIMATE') {
    return 'Estimated';
  }

  return item.confidence_label ?? 'Estimated';
}

function scaleParsedItems(items: ParsedFoodItem[], nextQuantity: number) {
  if (!items.length) {
    return items;
  }

  const baseline = items[0]?.quantity && items[0].quantity > 0 ? items[0].quantity : 1;
  const factor = nextQuantity / baseline;

  return items.map((item) => ({
    ...item,
    quantity: Number((item.quantity * factor).toFixed(2)),
    calories: Number((item.calories * factor).toFixed(1)),
    protein: Number((item.protein * factor).toFixed(1)),
    carbs: Number((item.carbs * factor).toFixed(1)),
    fat: Number((item.fat * factor).toFixed(1)),
    fiber: Number((item.fiber * factor).toFixed(1)),
    sugar: Number((item.sugar * factor).toFixed(1)),
    sodium: Number((item.sodium * factor).toFixed(1)),
  }));
}

function findItemIndex(items: ParsedFoodItem[], target: string) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) {
    return items.length ? items.length - 1 : -1;
  }

  return items.findIndex((item) => normalizeText(item.food_name).includes(normalizedTarget) || normalizedTarget.includes(normalizeText(item.food_name)));
}

function buildReplyFromItems(args: {
  intent: MealAssistantModelOutput['intent'];
  decisionReply: string;
  resolvedItems: ParsedFoodItem[];
  removedTargets?: string[];
  saved?: boolean;
  clarificationQuestion?: string | null;
  mealAlreadySaved?: boolean;
}) {
  const { intent, decisionReply, resolvedItems, removedTargets = [], saved = false, clarificationQuestion = null, mealAlreadySaved = false } = args;

  if (clarificationQuestion) {
    return clarificationQuestion;
  }

  if (saved) {
    return 'Saved. Anything else?';
  }

  if (intent === 'start_new_meal') {
    return 'Okay, starting fresh. What did you eat?';
  }

  if (intent === 'casual_message' || intent === 'unknown') {
    return decisionReply;
  }

  if (intent === 'remove_item' && removedTargets.length) {
    return `Removed ${removedTargets.join(', ')}.`;
  }

  if (!resolvedItems.length) {
    return decisionReply;
  }

  const mainItem = resolvedItems[0];
  const totalCalories = Math.round(sumTotals(resolvedItems).calories);
  const sourceLabel = getSourceLabel(mainItem);

  if (intent === 'quantity_change') {
    return `Updated that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}.`;
  }

  if (intent === 'correction') {
    return `Got it, I updated that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}. That's about ${totalCalories} calories total. ${sourceLabel}.`;
  }

  if (intent === 'add_to_current_meal') {
    const addedItem = resolvedItems.at(-1) ?? mainItem;
    return `Added ${addedItem.food_name}${resolvedItems.length > 1 ? ' to this meal' : ''}. ${getSourceLabel(addedItem)}.`;
  }

  if (intent === 'new_food_item' && mealAlreadySaved) {
    return `Got it, starting a new meal with ${mainItem.food_name}. ${sourceLabel}.`;
  }

  return `Got it — ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}, about ${totalCalories} calories total. ${sourceLabel}.`;
}

async function defaultResolveItemNutrition({ item, mealType }: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) {
  const query = buildItemLookupText(item);
  const resolved = await resolveNutritionEstimate({ text: query, mealType });

  if (resolved?.items.length) {
    return resolved;
  }

  const parsed = await parseMealText(query, mealType);
  if (!parsed.needs_clarification && parsed.items.length) {
    return parsed;
  }

  return getMockParsedMeal(query, mealType);
}

async function defaultSaveMeal({ state, items }: { state: MealAssistantState; items: ParsedFoodItem[] }) {
  if (state.editingMealId) {
    await updateSavedMeal(state.editingMealId, {
      meal_type: state.mealType,
      confidence_score: getConfidenceScore(items),
      raw_text: state.currentMealText,
      source_reusable_meal_id: state.sourceReusableMealId ?? null,
      items,
    });
    return;
  }

  await saveConfirmedMeal({
    meal_type: state.mealType,
    confidence_score: getConfidenceScore(items),
    raw_text: state.currentMealText,
    source_reusable_meal_id: state.sourceReusableMealId ?? null,
    items,
  });
}

function buildFallbackReply(input: string, state: MealAssistantState) {
  if (casualRegex.test(input) || offTopicRegex.test(input)) {
    return state.currentMealItems.length ? 'I can keep working on this meal, or you can send the next food.' : 'I’m here to help log meals. What did you eat?';
  }

  return state.currentMealItems.length ? 'Got it.' : 'Tell me what you ate.';
}

function extractFallbackItems(input: string, state: MealAssistantState): MealAssistantItem[] {
  const normalized = input.trim().toLowerCase();

  if (removeRegex.test(normalized)) {
    const target = normalized.match(removeRegex)?.[1] ?? '';
    return [
      {
        name: target,
        brand: null,
        quantity: 1,
        unit: null,
        modifiers: [],
        action: 'remove',
      },
    ];
  }

  const brand = /\bquaker\b/.test(normalized)
    ? 'Quaker'
    : /\bdaisy\b/.test(normalized)
      ? 'Daisy'
      : /\bmcdouble\b|\bmcdonald/.test(normalized)
        ? "McDonald's"
        : /\btaco bell\b/.test(normalized)
          ? 'Taco Bell'
          : null;

  const quantityMatch = normalized.match(quantityOnlyRegex) ?? normalized.match(directQuantityRegex);
  const quantity = quantityMatch ? parseCount(quantityMatch[1] ?? quantityMatch[0]) : 1;
  const stripped = normalized
    .replace(/^(?:actually|make that|update that to|it was|that was|no,?|i meant|instead|and|also|plus|with)\s+/i, '')
    .replace(/^(?:\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
    .trim();

  const namedFallback = state.currentMealItems.at(-1)?.food_name ?? 'meal item';

  if (!stripped && state.currentMealItems.length) {
    return [
      {
        name: namedFallback,
        brand: null,
        quantity,
        unit: state.currentMealItems.at(-1)?.unit ?? null,
        modifiers: [],
        action: 'update',
      },
    ];
  }

  const name = stripped
    .replace(/\blow fat\b/g, 'cottage cheese')
    .replace(/\bwhite cheddar rice cakes?\b/g, 'rice cakes')
    .replace(/\s+/g, ' ')
    .trim() || namedFallback;

  const modifiers = [
    /white cheddar/.test(normalized) ? 'white cheddar' : null,
    /low fat/.test(normalized) ? 'low fat' : null,
  ].filter((value): value is string => Boolean(value));

  return [
    {
      name,
      brand,
      quantity,
      unit: /eggs?/.test(normalized) ? 'egg' : /rice cakes?/.test(normalized) ? 'cake' : null,
      modifiers,
      action: state.pendingClarification || /^no\b|^actually\b|^i meant\b|^instead\b/i.test(normalized) ? 'replace' : continuationRegex.test(normalized) ? 'add' : 'add',
    },
  ];
}

function classifyFallback({ message, state }: MealAssistantRunInput): MealAssistantModelOutput {
  const normalized = message.trim().toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (saveRegex.test(normalized)) {
    return {
      intent: 'save_meal',
      assistant_reply: 'Saved.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: true,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (startNewRegex.test(normalized)) {
    return {
      intent: 'start_new_meal',
      assistant_reply: 'Okay, starting fresh.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (casualRegex.test(normalized) || offTopicRegex.test(normalized)) {
    return {
      intent: 'casual_message',
      assistant_reply: buildFallbackReply(message, state),
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    };
  }

  if (removeRegex.test(normalized)) {
    return {
      intent: 'remove_item',
      assistant_reply: 'Got it.',
      items: extractFallbackItems(message, state),
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (state.pendingClarification && /^(?:no|actually|i meant|instead|they were|it was)\b/i.test(normalized)) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'correction',
      assistant_reply: 'Got it.',
      items,
      corrections: [{ target: state.pendingClarification, change: message }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (state.pendingClarification) {
    return {
      intent: 'clarification_answer',
      assistant_reply: 'Got it.',
      items: extractFallbackItems(message, state),
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (quantityOnlyRegex.test(normalized) && hasActiveMeal) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'quantity_change',
      assistant_reply: 'Updated.',
      items,
      corrections: [{ target: state.currentMealItems.at(-1)?.food_name ?? 'current item', change: message }],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (/^(?:no|actually|i meant|instead|not )\b/i.test(normalized)) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'correction',
      assistant_reply: 'Got it.',
      items,
      corrections: [{ target: state.currentMealItems.at(-1)?.food_name ?? 'current item', change: message }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  const items = extractFallbackItems(message, state);

  return {
    intent: hasActiveMeal && continuationRegex.test(normalized) ? 'add_to_current_meal' : 'new_food_item',
    assistant_reply: 'Got it.',
    items,
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'medium',
  };
}

async function classifyWithModel(input: MealAssistantRunInput): Promise<MealAssistantModelOutput> {
  if (!process.env.OPENAI_API_KEY) {
    return classifyFallback(input);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: mealAssistantSystemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          message: input.message,
          state: input.state,
          user_preferences: input.userPreferences ?? null,
        }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return classifyFallback(input);
  }

  try {
    return mealAssistantModelOutputSchema.parse(JSON.parse(content));
  } catch {
    return classifyFallback(input);
  }
}

function applyRemovedItems(currentItems: ParsedFoodItem[], itemsToRemove: MealAssistantItem[]) {
  const removedTargets: string[] = [];
  const nextItems = [...currentItems];

  for (const removal of itemsToRemove) {
    const target = removal.brand ? `${removal.brand} ${removal.name}` : removal.name;
    const index = findItemIndex(nextItems, target);
    if (index >= 0) {
      removedTargets.push(nextItems[index].food_name);
      nextItems.splice(index, 1);
    }
  }

  return { nextItems, removedTargets };
}

async function resolveAssistantItems(
  items: MealAssistantItem[],
  mealType: MealAssistantState['mealType'],
  resolveItemNutrition: NutritionResolver,
) {
  const resolved: ParsedFoodItem[] = [];

  for (const item of items) {
    const response = await resolveItemNutrition({ item, mealType });
    if (response?.items.length) {
      resolved.push(...response.items);
      continue;
    }
  }

  return resolved;
}

export async function runMealAssistant(
  input: MealAssistantRunInput,
  dependencies: MealAssistantDependencies = {},
): Promise<MealAssistantResponse> {
  const classify = dependencies.classify ?? classifyWithModel;
  const resolveItemNutrition = dependencies.resolveItemNutrition ?? defaultResolveItemNutrition;
  const saveMeal = dependencies.saveMeal ?? defaultSaveMeal;
  const state = { ...input.state };
  const decision = await classify(input);
  let nextState: MealAssistantState = {
    ...state,
    userCorrections: [...state.userCorrections],
    currentMealItems: [...state.currentMealItems],
  };

  let resolvedItems = [...nextState.currentMealItems];
  let removedTargets: string[] = [];
  let clarificationQuestion: string | null = null;
  let saved = false;
  let suppressedClarification = false;

  if (decision.intent === 'start_new_meal') {
    nextState = {
      ...nextState,
      currentMealItems: [],
      pendingClarification: null,
      lastAssistantQuestion: null,
      currentMealText: null,
      confidenceScore: 0.82,
      saved: false,
      userCorrections: [],
    };
  } else if (decision.intent === 'save_meal' || decision.should_save_meal) {
    if (nextState.currentMealItems.length) {
      await saveMeal({ state: nextState, items: nextState.currentMealItems });
      nextState.saved = true;
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      saved = true;
    }
  } else if (decision.should_ask_clarification && decision.clarification_question && decision.clarification_question !== state.lastAssistantQuestion) {
    clarificationQuestion = decision.clarification_question;
    nextState.pendingClarification = decision.clarification_question;
    nextState.lastAssistantQuestion = decision.clarification_question;
    nextState.saved = false;
  } else if (decision.should_ask_clarification && decision.clarification_question === state.lastAssistantQuestion) {
    suppressedClarification = true;
    nextState.pendingClarification = state.pendingClarification;
    nextState.lastAssistantQuestion = state.lastAssistantQuestion;
    nextState.saved = false;
  } else if (decision.intent === 'remove_item') {
    const removalResult = applyRemovedItems(nextState.currentMealItems, decision.items);
    nextState.currentMealItems = removalResult.nextItems;
    nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
    nextState.pendingClarification = null;
    nextState.lastAssistantQuestion = null;
    nextState.saved = false;
    nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
    resolvedItems = nextState.currentMealItems;
    removedTargets = removalResult.removedTargets;
  } else if (decision.items.length) {
    const shouldResetForNewMeal = decision.intent === 'new_food_item' && (!state.currentMealItems.length || state.saved);
    if (shouldResetForNewMeal) {
      nextState.currentMealItems = [];
      nextState.currentMealText = null;
      nextState.userCorrections = [];
    }

    if (decision.intent === 'quantity_change' && state.currentMealItems.length) {
      const updateItem = decision.items[0];
      const targetIndex = findItemIndex(nextState.currentMealItems, updateItem.name);
      const nextQuantity = updateItem.quantity;
      if (targetIndex >= 0) {
        const target = nextState.currentMealItems[targetIndex];
        const updatedItems = scaleParsedItems([target], nextQuantity);
        nextState.currentMealItems = nextState.currentMealItems.map((item, index) => (index === targetIndex ? updatedItems[0] : item));
      }
      nextState.userCorrections.push(input.message);
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      nextState.saved = false;
      nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
      nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
      resolvedItems = nextState.currentMealItems;
    } else {
      const lookedUpItems = decision.should_lookup_nutrition
        ? await resolveAssistantItems(decision.items, nextState.mealType, resolveItemNutrition)
        : [];

      if (decision.intent === 'correction' || decision.intent === 'clarification_answer') {
        nextState.userCorrections.push(input.message);
        if (lookedUpItems.length) {
          nextState.currentMealItems = lookedUpItems;
        }
      } else if (decision.intent === 'new_food_item') {
        nextState.currentMealItems = lookedUpItems;
      } else if (decision.intent === 'add_to_current_meal') {
        nextState.currentMealItems = [...nextState.currentMealItems, ...lookedUpItems];
      } else {
        nextState.currentMealItems = lookedUpItems.length ? lookedUpItems : nextState.currentMealItems;
      }

      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      nextState.saved = false;
      nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
      nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
      resolvedItems = nextState.currentMealItems;
    }
  }

  const mealItems = nextState.currentMealItems;
  const totals = sumTotals(mealItems);
  const response: MealAssistantResponse = {
    ...decision,
    assistant_reply: buildReplyFromItems({
      intent: decision.intent,
      decisionReply: suppressedClarification
        ? 'Got it, I’m checking that again.'
        : decision.assistant_reply || buildFallbackReply(input.message, state),
      resolvedItems: resolvedItems.length ? resolvedItems : mealItems,
      removedTargets,
      saved,
      clarificationQuestion,
      mealAlreadySaved: state.saved,
    }),
    should_ask_clarification: Boolean(clarificationQuestion),
    clarification_question: clarificationQuestion,
    meal: {
      items: mealItems,
      totals,
      confidence_score: nextState.confidenceScore,
    },
    next_state: {
      ...nextState,
      currentMealItems: mealItems,
      currentMealText: mealItems.length ? nextState.currentMealText ?? buildMealTextFromItems(mealItems) : null,
      confidenceScore: nextState.confidenceScore,
      pendingClarification: suppressedClarification ? nextState.pendingClarification : clarificationQuestion,
      lastAssistantQuestion: suppressedClarification ? nextState.lastAssistantQuestion : clarificationQuestion,
      saved,
    },
  };

  return response;
}

export type { MealAssistantDependencies, MealAssistantRunInput };
