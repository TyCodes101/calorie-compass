import OpenAI from 'openai';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { parseMealText } from '@/lib/ai/openai';
import { mealAssistantSystemPrompt } from '@/lib/ai/mealAssistantSystemPrompt';
import {
  type MealAssistantContext,
  type MealAssistantItem,
  type MealAssistantMemoryMeal,
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
const repeatYesterdayRegex = /\b(?:repeat|log|use|same as|what(?: did)? i (?:have|eat|log))\s+yesterday(?:'?s)?\b|\byesterday(?:'?s)?\b/i;
const usualRegex = /\b(?:same as usual|my usual|the usual|usual)\b/i;
const repeatCueRegex = /\b(?:same|usual|again|repeat|yesterday|last time)\b/i;
const calorieLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+calories?\s+(?:do i have\s+)?(?:left|remaining)\b|\bcalories?\s+left\b/i;
const proteinLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+protein\s+(?:do i have\s+)?(?:left|remaining)\b|\bprotein\s+left\b/i;
const onTrackRegex = /\bam i on track\b|\bhow am i doing\b|\bdid i hit my goal\b|\bon track\b/i;
const dinnerSuggestionRegex = /\b(?:what should i eat tonight|what should i have tonight|what should i eat for dinner|what should i have for dinner|dinner idea|dinner ideas)\b/i;
const snackSuggestionRegex = /\b(?:high protein snack|protein snack|snack idea|snack ideas|what should i snack on|what's a good snack|what is a good snack)\b/i;
const currentMealProteinRegex = /\b(?:how much|how many|what(?:'s| is)).*protein.*(?:this|that|meal|shake|bowl|burger)\b|\bhow much protein is (?:this|that)\b/i;
const currentMealCaloriesRegex = /\b(?:how many|how much|what(?:'s| is)).*calories?.*(?:this|that|meal|shake|bowl|burger)\b|\bhow many calories is (?:this|that)\b/i;
const mealTypeHintRegex = /\b(breakfast|lunch|dinner|snack)\b/i;
const stopWordRegex = /\b(i|me|my|mine|had|have|ate|drank|log|repeat|again|same|usual|use|using|as|the|a|an|for|to|of|this|that|yesterday|today|tonight|please|my|last|meal|food)\b/g;
const laughRegex = /^(?:lol|lmao|haha+|hehe+|rofl|😂|🤣)+[!. ]*$/i;
const appreciationRegex = /^(?:thanks|thank you|thx|appreciate it)[!. ]*$/i;
const sizeUpRegex = /\b(?:huge|massive|giant|really big|extra big|super big)\b/i;
const sizeDownRegex = /\b(?:small|tiny|light|not that much|pretty small)\b/i;
const healthyCueRegex = /\b(?:healthy|balanced|pretty healthy|pretty balanced|not too bad|clean)\b/i;

const emptyContext: MealAssistantContext = {
  favoriteMeals: [],
  recentMeals: [],
  assistantMemory: undefined,
  nutritionPreferences: null,
  proteinGoal: null,
  dailyCalorieGoal: null,
  todayProtein: null,
  todayCalories: null,
  remainingProtein: null,
  remainingCalories: null,
  todayMealCount: null,
};

type MealAssistantRunInput = {
  message: string;
  state: MealAssistantState;
  context?: MealAssistantContext;
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

type MemoryEntry = MealAssistantMemoryMeal & {
  source: 'favorite' | 'recent' | 'memory';
};

type MemoryMatch = {
  candidate: MemoryEntry;
  mode: 'yesterday' | 'usual' | 'recent';
  appendToCurrentMeal: boolean;
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

function shorten(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function tokenizeText(text: string) {
  return normalizeText(text)
    .replace(stopWordRegex, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
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

function cloneParsedItems(items: ParsedFoodItem[]) {
  return items.map((item) => ({ ...item }));
}

function findItemIndex(items: ParsedFoodItem[], target: string) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) {
    return items.length ? items.length - 1 : -1;
  }

  return items.findIndex((item) => normalizeText(item.food_name).includes(normalizedTarget) || normalizedTarget.includes(normalizeText(item.food_name)));
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function choosePhrase(seed: string, variants: string[]) {
  return variants[hashText(seed) % variants.length] ?? variants[0] ?? '';
}

function cleanMealReferenceText(text: string | null | undefined) {
  const cleaned = (text ?? '')
    .trim()
    .replace(/^i\s+(?:had|ate|drank)\s+/i, '')
    .replace(/^for\s+(?:breakfast|lunch|dinner|a snack),?\s*/i, '')
    .replace(/^my\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');

  return cleaned;
}

function buildMemoryReference(candidate: MemoryEntry) {
  const fallback = candidate.items.length === 1 ? candidate.items[0]?.food_name ?? candidate.title : candidate.title;
  return shorten(cleanMealReferenceText(candidate.rawText) || cleanMealReferenceText(candidate.title) || fallback || 'that meal');
}

function postProcessAssistantReply(reply: string, state: MealAssistantState) {
  let nextReply = reply
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,])/g, '$1');

  if (!nextReply) {
    nextReply = state.currentMealItems.length ? 'Got it.' : 'Tell me what you ate.';
  }

  if (!/[.!?]$/.test(nextReply)) {
    nextReply = `${nextReply}.`;
  }

  if (nextReply.length > 170) {
    nextReply = `${nextReply.slice(0, 167).trimEnd()}…`;
  }

  if (state.lastAssistantReply && normalizeText(state.lastAssistantReply) === normalizeText(nextReply)) {
    if (/^got it\b/i.test(nextReply)) {
      nextReply = nextReply.replace(/^got it\b/i, 'Okay');
    } else if (/^saved\b/i.test(nextReply)) {
      nextReply = 'Saved. Ready for the next one?';
    } else {
      nextReply = choosePhrase(nextReply, [nextReply, `Okay, ${nextReply.charAt(0).toLowerCase()}${nextReply.slice(1)}`]);
    }
  }

  return nextReply;
}

function getMemoryEntries(context: MealAssistantContext) {
  const favoriteEntries: MemoryEntry[] = (context.favoriteMeals ?? []).map((meal) => ({
    ...meal,
    source: 'favorite',
  }));
  const recentEntries: MemoryEntry[] = (context.recentMeals ?? []).map((meal) => ({
    ...meal,
    source: 'recent',
  }));
  const localMemoryEntries: MemoryEntry[] = (context.assistantMemory?.recurringMeals ?? []).map((meal) => ({
    ...meal,
    source: 'memory',
    sourceReusableMealId: meal.source === 'favorite' ? meal.id : null,
  }));

  return [...favoriteEntries, ...recentEntries, ...localMemoryEntries];
}

function parseIsoTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isYesterday(value: string | null | undefined) {
  const timestamp = parseIsoTime(value);
  if (timestamp === null) {
    return false;
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const candidate = new Date(timestamp);
  const candidateDay = Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate());
  const diffDays = Math.round((today - candidateDay) / 86400000);
  return diffDays === 1;
}

function extractMealTypeHint(message: string) {
  const match = message.match(mealTypeHintRegex)?.[1]?.toLowerCase();
  if (match === 'breakfast' || match === 'lunch' || match === 'dinner' || match === 'snack') {
    return match;
  }

  return null;
}

function buildMemoryTarget(message: string) {
  return message
    .toLowerCase()
    .replace(/^(?:and|also|plus|with)\s+/i, '')
    .replace(/\b(?:same as usual|my usual|the usual)\b/gi, ' ')
    .replace(/\b(?:same|usual|repeat|again|yesterday|last time|log|use|for|please|my|meal)\b/gi, ' ')
    .replace(mealTypeHintRegex, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMemorySearchText(entry: MemoryEntry) {
  return normalizeText([
    entry.title,
    entry.rawText ?? '',
    ...entry.items.map((item) => item.food_name),
    ...entry.items.map((item) => item.source_name ?? ''),
  ].join(' '));
}

function getEntrySortTimestamp(entry: MemoryEntry) {
  return parseIsoTime(entry.lastUsedAt) ?? parseIsoTime(entry.createdAt) ?? 0;
}

function scoreMemoryEntry(entry: MemoryEntry, options: { targetText: string; mealTypeHint: string | null; preferFavorite: boolean; requireYesterday: boolean }) {
  if (!entry.items.length) {
    return Number.NEGATIVE_INFINITY;
  }

  if (options.requireYesterday && !isYesterday(entry.createdAt)) {
    return Number.NEGATIVE_INFINITY;
  }

  const searchText = buildMemorySearchText(entry);
  const targetTokens = tokenizeText(options.targetText);
  const phrase = normalizeText(options.targetText);
  const mealTypeMatches = options.mealTypeHint ? entry.mealType === options.mealTypeHint : false;

  let score = 0;

  if (options.preferFavorite && entry.source === 'favorite') {
    score += 6;
  }

  if (options.requireYesterday && isYesterday(entry.createdAt)) {
    score += 8;
  }

  if (mealTypeMatches) {
    score += 3;
  }

  if (targetTokens.length) {
    const overlap = targetTokens.filter((token) => searchText.includes(token)).length;
    if (!overlap) {
      return Number.NEGATIVE_INFINITY;
    }

    score += overlap * 2.5;

    if (phrase && (searchText.includes(phrase) || phrase.includes(searchText))) {
      score += 8;
    }
  } else {
    score += entry.source === 'recent' ? 1 : 0;
  }

  score += getEntrySortTimestamp(entry) / 1_000_000_000_000;
  return score;
}

function findMatchingMemoryMeal(input: MealAssistantRunInput, context: MealAssistantContext): MemoryMatch | null {
  const normalized = input.message.trim().toLowerCase();
  const entries = getMemoryEntries(context);

  if (!entries.length || !repeatCueRegex.test(normalized)) {
    return null;
  }

  const mealTypeHint = extractMealTypeHint(input.message) ?? null;
  const appendToCurrentMeal = input.state.currentMealItems.length > 0 && continuationRegex.test(normalized);
  const requireYesterday = repeatYesterdayRegex.test(normalized);
  const preferFavorite = usualRegex.test(normalized) || /\bmy usual\b/i.test(normalized);
  const targetText = buildMemoryTarget(input.message);

  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreMemoryEntry(entry, {
        targetText,
        mealTypeHint,
        preferFavorite,
        requireYesterday,
      }),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) {
    return null;
  }

  const minimumScore = targetText ? 3 : requireYesterday ? 6 : preferFavorite ? 4 : 2;
  if (best.score < minimumScore) {
    return null;
  }

  return {
    candidate: best.entry,
    mode: requireYesterday ? 'yesterday' : best.entry.source === 'favorite' || best.entry.source === 'memory' || preferFavorite ? 'usual' : 'recent',
    appendToCurrentMeal,
  };
}

function buildMemoryLoadReply(match: MemoryMatch, message: string) {
  const reference = buildMemoryReference(match.candidate);
  const seed = `${message}:${match.candidate.id}:${match.mode}:${match.appendToCurrentMeal ? 'append' : 'replace'}`;

  if (match.appendToCurrentMeal) {
    if (match.mode === 'usual') {
      return choosePhrase(seed, [`Added your usual ${reference}`, `Added that usual ${reference}`]);
    }

    if (match.mode === 'yesterday') {
      return choosePhrase(seed, [`Added yesterday's ${reference}`, `Pulled in yesterday's ${reference}`]);
    }

    return choosePhrase(seed, [`Added ${reference} again`, `Brought ${reference} back in`]);
  }

  if (match.mode === 'usual') {
    return choosePhrase(seed, [`Using your usual ${reference}`, `I've got your usual ${reference}`]);
  }

  if (match.mode === 'yesterday') {
    return choosePhrase(seed, [`I pulled in yesterday's ${reference}`, `Using yesterday's ${reference}`]);
  }

  return choosePhrase(seed, [`I loaded ${reference} again`, `Pulled back ${reference}`]);
}

function buildCasualReply(message: string, state: MealAssistantState) {
  const normalized = message.trim().toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (/how(?:'|’)??s your day|how are you/.test(normalized)) {
    return hasActiveMeal ? 'I can keep working on this meal, or you can send the next food.' : 'I’m here to help log meals. What did you eat?';
  }

  if (laughRegex.test(normalized)) {
    return hasActiveMeal ? '😂 alright, what else did you eat?' : '😂 alright, what did you have?';
  }

  if (appreciationRegex.test(normalized)) {
    return hasActiveMeal ? 'Anytime. Want to add anything else to this meal?' : 'Anytime. Send the meal whenever you’re ready.';
  }

  if (casualRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['Got you. Keep going whenever you want.', 'All good. Send the next thing when you’re ready.'])
      : choosePhrase(normalized, ['All good. What did you eat?', 'Yep, send the meal whenever you’re ready.']);
  }

  if (offTopicRegex.test(normalized)) {
    return hasActiveMeal ? 'I can keep working on this meal, or you can send the next food.' : 'I’m here for the food side. What did you eat?';
  }

  return null;
}

function scaleMealAtIndex(items: ParsedFoodItem[], index: number, factor: number) {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    return {
      ...item,
      quantity: Number((item.quantity * factor).toFixed(2)),
      calories: Number((item.calories * factor).toFixed(1)),
      protein: Number((item.protein * factor).toFixed(1)),
      carbs: Number((item.carbs * factor).toFixed(1)),
      fat: Number((item.fat * factor).toFixed(1)),
      fiber: Number((item.fiber * factor).toFixed(1)),
      sugar: Number((item.sugar * factor).toFixed(1)),
      sodium: Number((item.sodium * factor).toFixed(1)),
      notes: item.notes ?? 'Adjusted from conversational sizing cue.',
    };
  });
}

function findContextualItemIndex(message: string, items: ParsedFoodItem[]) {
  const normalizedMessage = normalizeText(message);

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) {
      continue;
    }

    if (normalizedMessage.includes(normalizeText(item.food_name))) {
      return index;
    }
  }

  return items.length ? items.length - 1 : -1;
}

function buildMealDescriptorReply(input: MealAssistantRunInput, context: MealAssistantContext): MealAssistantResponse | null {
  if (!input.state.currentMealItems.length) {
    return null;
  }

  const normalized = input.message.trim().toLowerCase();
  const targetIndex = findContextualItemIndex(input.message, input.state.currentMealItems);
  if (targetIndex < 0) {
    return null;
  }

  const currentItems = cloneParsedItems(input.state.currentMealItems);
  const targetItem = currentItems[targetIndex];
  if (!targetItem) {
    return null;
  }

  if (sizeUpRegex.test(normalized) || sizeDownRegex.test(normalized)) {
    const factor = sizeUpRegex.test(normalized) ? 1.2 : 0.85;
    const nextItems = scaleMealAtIndex(currentItems, targetIndex, factor);
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    const reply = sizeUpRegex.test(normalized)
      ? choosePhrase(`${normalized}:${targetItem.food_name}`, [
          `Got you, I’ll lean bigger on ${targetItem.food_name}.`,
          `Okay, I bumped ${targetItem.food_name} up a bit.`,
          `Makes sense, I’m treating ${targetItem.food_name} as a larger serving.`,
        ])
      : choosePhrase(`${normalized}:${targetItem.food_name}`, [
          `Got it, I’ll keep ${targetItem.food_name} a little lighter.`,
          `Okay, I trimmed ${targetItem.food_name} down a bit.`,
          `Makes sense, I’m leaning smaller on ${targetItem.food_name}.`,
        ]);

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: reply,
      nextState,
    });
  }

  if (healthyCueRegex.test(normalized)) {
    const totals = sumTotals(currentItems);
    const proteinLeft = getRemainingProtein(context);
    const reply = totals.protein >= 25
      ? choosePhrase(`${normalized}:${totals.protein}`, [
          'Yeah, that looks pretty balanced overall, especially with the protein.',
          'Honestly, that looks fairly solid, especially on the protein side.',
        ])
      : proteinLeft !== null && proteinLeft > 0
        ? 'Yeah, that sounds pretty balanced. You could still use a little more protein later.'
        : 'Yeah, that sounds pretty balanced overall.';

    return buildDirectResponse({
      intent: 'casual_message',
      assistantReply: reply,
      nextState: {
        ...input.state,
        currentMealItems: currentItems,
        currentMealText: input.state.currentMealText ?? buildMealTextFromItems(currentItems),
        confidenceScore: input.state.confidenceScore ?? getConfidenceScore(currentItems),
      },
    });
  }

  return null;
}

function buildDirectResponse(args: {
  intent: MealAssistantModelOutput['intent'];
  assistantReply: string;
  nextState: MealAssistantState;
}) {
  const mealItems = args.nextState.currentMealItems;
  const totals = sumTotals(mealItems);
  const assistantReply = postProcessAssistantReply(args.assistantReply, args.nextState);

  return {
    intent: args.intent,
    assistant_reply: assistantReply,
    items: [],
    corrections: [],
    should_lookup_nutrition: false,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
    meal: {
      items: mealItems,
      totals,
      confidence_score: args.nextState.confidenceScore,
    },
    next_state: {
      ...args.nextState,
      lastAssistantReply: assistantReply,
    },
  } satisfies MealAssistantResponse;
}

function getRemainingProtein(context: MealAssistantContext) {
  if (context.remainingProtein !== null && context.remainingProtein !== undefined) {
    return Math.max(0, Math.round(context.remainingProtein));
  }

  if (context.proteinGoal !== null && context.proteinGoal !== undefined && context.todayProtein !== null && context.todayProtein !== undefined) {
    return Math.max(0, Math.round(context.proteinGoal - context.todayProtein));
  }

  return null;
}

function getRemainingCalories(context: MealAssistantContext) {
  if (context.remainingCalories !== null && context.remainingCalories !== undefined) {
    return Math.round(context.remainingCalories);
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayCalories !== null && context.todayCalories !== undefined) {
    return Math.round(context.dailyCalorieGoal - context.todayCalories);
  }

  return null;
}

function findSuggestionCandidate(context: MealAssistantContext, options?: { mealType?: MealAssistantState['mealType'] | null; maxCalories?: number | null; minProtein?: number }) {
  const minProtein = options?.minProtein ?? 20;
  const entries = getMemoryEntries(context).filter((entry) => entry.items.length > 0);

  const ranked = entries
    .map((entry) => {
      const totals = sumTotals(entry.items);
      const mealTypeBonus = options?.mealType && entry.mealType === options.mealType ? 4 : 0;
      const proteinBonus = totals.protein >= minProtein ? totals.protein : -10;
      const caloriesPenalty = options?.maxCalories && totals.calories > options.maxCalories ? (totals.calories - options.maxCalories) / 40 : 0;
      const sourceBonus = entry.source === 'favorite' ? 3 : 0;
      const snackSignal = /shake|yogurt|cottage cheese|protein|bar|snack/i.test(buildMemoryReference(entry)) ? 2 : 0;

      return {
        entry,
        totals,
        score: mealTypeBonus + proteinBonus + sourceBonus + snackSignal - caloriesPenalty,
      };
    })
    .filter((entry) => entry.totals.protein >= minProtein)
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}

function buildNutritionGuidanceReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const currentTotals = sumTotals(input.state.currentMealItems);
  const remainingProtein = getRemainingProtein(context);
  const remainingCalories = getRemainingCalories(context);

  if (currentMealProteinRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.protein)}g of protein.`;
  }

  if (currentMealCaloriesRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.calories)} calories.`;
  }

  if (proteinLeftRegex.test(normalized)) {
    return remainingProtein !== null ? `You've got about ${remainingProtein}g of protein left today.` : 'I can estimate that once your daily goal is set.';
  }

  if (calorieLeftRegex.test(normalized)) {
    if (remainingCalories === null) {
      return 'I can estimate that once your daily calorie goal is set.';
    }

    return remainingCalories >= 0
      ? `You've got about ${remainingCalories} calories left today.`
      : `You're about ${Math.abs(remainingCalories)} calories over right now.`;
  }

  if (onTrackRegex.test(normalized)) {
    if (remainingCalories === null && remainingProtein === null) {
      return 'You look steady so far. I can be more specific once your daily goals are set.';
    }

    if (remainingCalories !== null && remainingCalories < 0) {
      return remainingProtein !== null && remainingProtein > 0
        ? `A little over on calories, and you still have about ${remainingProtein}g of protein left. Keep the rest lighter.`
        : 'A little over on calories, so keep the rest of the day lighter and simple.';
    }

    if (remainingProtein !== null && remainingProtein > 35) {
      return remainingCalories !== null
        ? `Pretty solid on calories. You're still about ${remainingProtein}g short on protein, with ${remainingCalories} calories left.`
        : `Pretty solid overall, but you're still about ${remainingProtein}g short on protein.`;
    }

    if (remainingCalories !== null && remainingProtein !== null) {
      return `Yeah, you're in a good spot. About ${remainingCalories} calories and ${remainingProtein}g protein left.`;
    }

    if (remainingCalories !== null) {
      return `Yeah, you're in a good spot. About ${remainingCalories} calories left.`;
    }

    return `Yeah, you're in a good spot. About ${remainingProtein ?? 0}g of protein left.`;
  }

  if (snackSuggestionRegex.test(normalized)) {
    const suggestion = findSuggestionCandidate(context, {
      mealType: 'snack',
      maxCalories: remainingCalories !== null && remainingCalories > 0 ? Math.min(remainingCalories, 350) : 350,
      minProtein: remainingProtein !== null && remainingProtein > 20 ? 20 : 12,
    });

    if (suggestion) {
      return `A good easy one would be ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)}.`;
    }

    return remainingProtein !== null && remainingProtein > 20
      ? 'A shake, Greek yogurt, cottage cheese, or turkey jerky would be an easy high-protein snack.'
      : 'Greek yogurt, cottage cheese, fruit with yogurt, or a shake would all work well.';
  }

  if (dinnerSuggestionRegex.test(normalized)) {
    const suggestion = findSuggestionCandidate(context, {
      mealType: 'dinner',
      maxCalories: remainingCalories !== null && remainingCalories > 0 ? Math.min(remainingCalories, 900) : 900,
      minProtein: remainingProtein !== null && remainingProtein > 30 ? 25 : 18,
    });

    if (suggestion) {
      return `Tonight, ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)} would fit pretty well.`;
    }

    if (remainingCalories !== null && remainingCalories < 350) {
      return 'Keep dinner light and protein-forward, like grilled chicken, Greek yogurt, or cottage cheese.';
    }

    return remainingProtein !== null && remainingProtein > 30
      ? 'Go protein-forward tonight. Grilled chicken, a burrito bowl with extra protein, or rice with lean meat would make sense.'
      : 'Keep dinner simple and steady, something like chicken, rice, potatoes, or a burrito bowl.';
  }

  return null;
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
  const casualReply = buildCasualReply(input, state);
  if (casualReply) {
    return casualReply;
  }

  return state.currentMealItems.length
    ? choosePhrase(input, ['Got it.', 'Okay.', 'Alright.', 'Makes sense.'])
    : choosePhrase(input, ['Tell me what you ate.', 'What did you have?', 'Send the meal whenever you’re ready.']);
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
          : /\bchipotle\b/.test(normalized)
            ? 'Chipotle'
            : /\bfairlife\b/.test(normalized)
              ? 'Fairlife'
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
    /double chicken/.test(normalized) ? 'double chicken' : null,
    /white rice/.test(normalized) ? 'white rice' : null,
  ].filter((value): value is string => Boolean(value));

  return [
    {
      name,
      brand,
      quantity,
      unit: /eggs?/.test(normalized) ? 'egg' : /rice cakes?/.test(normalized) ? 'cake' : /shake/.test(normalized) ? 'bottle' : null,
      modifiers,
      action: state.pendingClarification || /^(?:no|actually|i meant|instead)\b/i.test(normalized) ? 'replace' : 'add',
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
          context: input.context ?? emptyContext,
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
    }
  }

  return resolved;
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
    return choosePhrase(decisionReply, ['Okay, starting fresh. What did you eat?', 'Alright, new meal. What’d you have?', 'Fresh start. What did you eat?']);
  }

  if (intent === 'casual_message' || intent === 'unknown' || intent === 'nutrition_guidance') {
    return decisionReply;
  }

  if (intent === 'remove_item' && removedTargets.length) {
    return choosePhrase(removedTargets.join(','), [`Removed ${removedTargets.join(', ')}.`, `Okay, I took out ${removedTargets.join(', ')}.`, `${removedTargets.join(', ')} is out now.`]);
  }

  if (!resolvedItems.length) {
    return decisionReply;
  }

  const mainItem = resolvedItems[0];
  const totalCalories = Math.round(sumTotals(resolvedItems).calories);
  const sourceLabel = getSourceLabel(mainItem);
  const seed = `${intent}:${mainItem.food_name}:${totalCalories}:${sourceLabel}`;

  if (intent === 'quantity_change') {
    return choosePhrase(seed, [
      `Updated that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}.`,
      `Okay, I changed that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}.`,
      `Got you, that’s now ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}.`,
    ]);
  }

  if (intent === 'correction') {
    return choosePhrase(seed, [
      `Got it, I updated that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}. That's about ${totalCalories} calories total. ${sourceLabel}.`,
      `Okay, I switched that to ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}. About ${totalCalories} calories total. ${sourceLabel}.`,
      `Perfect, I’ve got that as ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}. Roughly ${totalCalories} calories. ${sourceLabel}.`,
    ]);
  }

  if (intent === 'add_to_current_meal') {
    const addedItem = resolvedItems.at(-1) ?? mainItem;
    const addedSeed = `${seed}:${addedItem.food_name}`;
    return choosePhrase(addedSeed, [
      `Added ${addedItem.food_name}${resolvedItems.length > 1 ? ' to this meal' : ''}. ${getSourceLabel(addedItem)}.`,
      `Got you, I added ${addedItem.food_name}. ${getSourceLabel(addedItem)}.`,
      `${addedItem.food_name} is in there too. ${getSourceLabel(addedItem)}.`,
      `Okay, adding ${addedItem.food_name} too. ${getSourceLabel(addedItem)}.`,
    ]);
  }

  if (intent === 'new_food_item' && mealAlreadySaved) {
    return choosePhrase(seed, [
      `Got it, starting a new meal with ${mainItem.food_name}. ${sourceLabel}.`,
      `Alright, new meal. I’ve got ${mainItem.food_name}. ${sourceLabel}.`,
      `Starting fresh with ${mainItem.food_name}. ${sourceLabel}.`,
    ]);
  }

  if (intent === 'repeat_meal') {
    return decisionReply;
  }

  return choosePhrase(seed, [
    `Got it, ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}, about ${totalCalories} calories total. ${sourceLabel}.`,
    `Okay, I’ve got ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}, roughly ${totalCalories} calories. ${sourceLabel}.`,
    `That looks like ${Number.isInteger(mainItem.quantity) ? mainItem.quantity : mainItem.quantity.toFixed(1)} ${mainItem.food_name}, around ${totalCalories} calories total. ${sourceLabel}.`,
  ]);
}

export async function runMealAssistant(
  input: MealAssistantRunInput,
  dependencies: MealAssistantDependencies = {},
): Promise<MealAssistantResponse> {
  const classify = dependencies.classify ?? classifyWithModel;
  const resolveItemNutrition = dependencies.resolveItemNutrition ?? defaultResolveItemNutrition;
  const saveMeal = dependencies.saveMeal ?? defaultSaveMeal;
  const context = input.context ?? emptyContext;
  const state = { ...input.state };

  if (!dependencies.classify) {
    const descriptorReply = buildMealDescriptorReply(input, context);
    if (descriptorReply) {
      return descriptorReply;
    }

    const casualReply = buildCasualReply(input.message, state);
    if (casualReply) {
      return buildDirectResponse({
        intent: 'casual_message',
        assistantReply: casualReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
      });
    }

    const memoryMatch = findMatchingMemoryMeal(input, context);
    if (memoryMatch) {
      const loadedItems = cloneParsedItems(memoryMatch.candidate.items);
      const nextItems = memoryMatch.appendToCurrentMeal ? [...state.currentMealItems, ...loadedItems] : loadedItems;
      const nextState: MealAssistantState = {
        ...state,
        currentMealItems: nextItems,
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: false,
        mealType: memoryMatch.appendToCurrentMeal ? state.mealType : memoryMatch.candidate.mealType,
        currentMealText: memoryMatch.appendToCurrentMeal
          ? buildMealTextFromItems(nextItems)
          : cleanMealReferenceText(memoryMatch.candidate.rawText) || cleanMealReferenceText(memoryMatch.candidate.title) || buildMealTextFromItems(nextItems),
        confidenceScore: memoryMatch.appendToCurrentMeal ? getConfidenceScore(nextItems) : memoryMatch.candidate.confidenceScore ?? getConfidenceScore(nextItems),
        sourceReusableMealId: memoryMatch.appendToCurrentMeal ? null : memoryMatch.candidate.source === 'favorite' ? memoryMatch.candidate.sourceReusableMealId ?? memoryMatch.candidate.id : null,
        editingMealId: null,
      };

      return buildDirectResponse({
        intent: memoryMatch.appendToCurrentMeal ? 'add_to_current_meal' : 'repeat_meal',
        assistantReply: buildMemoryLoadReply(memoryMatch, input.message),
        nextState,
      });
    }

    const nutritionReply = buildNutritionGuidanceReply(input, context);
    if (nutritionReply) {
      return buildDirectResponse({
        intent: 'nutrition_guidance',
        assistantReply: nutritionReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          pendingClarification: state.pendingClarification ?? null,
          lastAssistantQuestion: state.lastAssistantQuestion ?? null,
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
      });
    }
  }

  const decision = await classify({
    ...input,
    context,
  });

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
      sourceReusableMealId: null,
      editingMealId: null,
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
      nextState.sourceReusableMealId = null;
      nextState.editingMealId = null;
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
  const assistantReply = postProcessAssistantReply(
    buildReplyFromItems({
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
    state,
  );

  return {
    ...decision,
    assistant_reply: assistantReply,
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
      lastAssistantReply: assistantReply,
    },
  };
}

export type { MealAssistantDependencies, MealAssistantRunInput };
