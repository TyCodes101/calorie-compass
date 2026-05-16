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
  type MealAssistantTranscriptMessage,
  mealAssistantModelOutputSchema,
} from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { saveConfirmedMeal, updateSavedMeal } from '@/lib/meals';
import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';

const model = process.env.OPENAI_MEAL_MODEL ?? 'gpt-4.1-mini';
const greetingRegex = /^(?:hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/i;
const continuationRegex = /^(and|also|plus|with)\b/i;
const removeRegex = /^(?:remove|without|no|hold the|skip the)\s+(.+)$/i;
const startNewRegex = /^(?:start over|new meal|clear this|reset|fresh one|different meal)\b/i;
const saveRegex = /^(?:save(?: it| that| this)?|log(?: it| that| this)|done)\b/i;
const explicitQuantityUpdateRegex = /^(?:actually\s+)?(?:make|change|update)\s+(?:it|that|this)(?:\s+to)?\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const editRegex = /^(?:edit(?: it| that| this)?|change(?: it| that| this)?|tweak(?: it| that| this)?|adjust(?: it| that| this)?)\b/i;
const reviewRegex = /\b(?:review (?:it|this|that)|show me (?:the )?(?:meal|review)|what do i have so far|show me what i have)\b/i;
const quantityOnlyRegex = /^(?:actually|make that|update that to|it was|that was|no|i meant|instead)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const directQuantityRegex = /^(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const casualRegex = /^(?:hi|hello|hey|yo|sup|what(?:'|’)??s up|thanks|thank you|cool|okay|ok|nice|lol|how are you|how(?:'|’)??s your day)\b/i;
const offTopicRegex = /\b(?:weather|movie|music|homework|code|browser|news|sports|joke)\b/i;
const repeatYesterdayRegex = /\b(?:repeat|log|use|same as|what(?: did)? i (?:have|eat|log))\s+yesterday(?:'?s)?\b|\byesterday(?:'?s)?\b/i;
const usualRegex = /\b(?:same as usual|my usual|the usual|usual)\b/i;
const repeatCueRegex = /\b(?:same|usual|again|repeat|yesterday|last time)\b/i;
const followUpMacroRegex = /\bwhat about (?:carbs?|protein|fat|calories?)\b|\bhow about (?:carbs?|protein|fat|calories?)\b/i;
const calorieLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+(?:calories?|cals?)\s+(?:do i have\s+)?(?:left|remaining)\b|\b(?:calories?|cals?|cal)\s+left\b/i;
const proteinLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+protein\s+(?:do i have\s+)?(?:left|remaining)\b|\bprotein\s+left\b/i;
const carbsQuestionRegex = /\b(?:carbs?|carbohydrates?)\b/i;
const fatQuestionRegex = /\b(?:fat|fats)\b/i;
const proteinQuestionRegex = /\bprotein\b/i;
const caloriesQuestionRegex = /\bcalories?\b/i;
const onTrackRegex = /\bam i on track\b|\bhow am i doing\b|\bdid i hit my goal\b|\bon track\b/i;
const dinnerSuggestionRegex = /\b(?:what should i eat tonight|what should i have tonight|what should i eat for dinner|what should i have for dinner|dinner idea|dinner ideas|tonight idea|tonight ideas)\b/i;
const snackSuggestionRegex = /\b(?:high protein snack|protein snack|snack idea|snack ideas|what should i snack on|what's a good snack|what is a good snack)\b/i;
const snackRoomRegex = /\b(?:do i have room for a snack|room for a snack|can i have a snack|can i fit a snack|i(?: am|'m) in the snack room|in the snack room)\b/i;
const recommendationRegex = /\b(?:what should i eat|what should i have|what sounds good|give me (?:an?|some) ideas?|any ideas|recommend|suggest|something (?:sweet|lighter|healthy|healthier)|healthy snack|healthy dessert|dessert idea|quick meal|quick food|restaurant idea|healthier version|lighter version)\b/i;
const sweetHealthyRegex = /\b(?:sweet|dessert)\b.*\b(?:healthy|healthier|lighter|light)\b|\b(?:healthy|healthier|lighter|light)\b.*\b(?:sweet|dessert)\b/i;
const healthyTreatRegex = /\b(?:healthy treat|healthy snack|healthier treat|dessert|sweet snack)\b/i;
const lighterVersionRegex = /\b(?:lighter|healthier)\s+(?:version|option)\b|\bsomething lighter\b|\bhealthier version\b/i;
const grilledSwapRegex = /\b(?:make it grilled|grilled instead|swap .* for grilled|make that grilled)\b/i;
const doubleThatRegex = /^(?:double that|double it|make it double|double this)\b/i;
const comparisonRegex = /\b(?:better than|vs\.?|versus|compare)\b/i;
const currentMealProteinRegex = /\b(?:how much|how many|what(?:'s| is)).*protein.*(?:this|that|meal|shake|bowl|burger)\b|\bhow much protein is (?:this|that)\b/i;
const currentMealCaloriesRegex = /\b(?:how many|how much|what(?:'s| is)).*calories?.*(?:this|that|meal|shake|bowl|burger)\b|\bhow many calories is (?:this|that)\b/i;
const mealTypeHintRegex = /\b(breakfast|lunch|dinner|snack)\b/i;
const weeklySummaryRegex = /\b(?:how(?:'s| is) (?:this|my) week|weekly summary|week so far|how am i doing this week|this week)\b/i;
const stopWordRegex = /\b(i|me|my|mine|had|have|ate|drank|log|repeat|again|same|usual|use|using|as|the|a|an|for|to|of|this|that|yesterday|today|tonight|please|my|last|meal|food)\b/g;
const laughRegex = /^(?:lol|lmao|haha+|hehe+|rofl|😂|🤣)+[!. ]*$/i;
const appreciationRegex = /^(?:thanks|thank you|thx|appreciate it)[!. ]*$/i;
const frustrationRegex = /\b(?:ugh|oops|my bad|sorry|whoops|damn|dang|frustrat(?:ed|ing))\b/i;
const jokeRequestRegex = /\b(?:tell me a joke|say a joke|joke)\b/i;
const sizeUpRegex = /\b(?:huge|massive|giant|really big|extra big|super big)\b/i;
const sizeDownRegex = /\b(?:small|tiny|light|not that much|pretty small)\b/i;
const healthyCueRegex = /\b(?:healthy|balanced|pretty healthy|pretty balanced|not too bad|clean)\b/i;
const mealDescriptorReferenceRegex = /\b(?:that|this|it|meal|burger|bowl|shake|sandwich|breakfast|lunch|dinner|snack)\b/i;
const ambiguousFollowUpRegex = /^(?:what about that|what about it|how about that|how about it|is that okay|is it okay|does that work|which one|what do you mean|what does that mean|wym|wait)\b/i;

const genericResolvedFoodRegex = /^(?:estimated\s+)?(?:mixed\s+)?meal(?:\s+estimate)?$|^food(?:\s+item)?$|^item$/i;
const pizzaNameRegex = /\bpizza\b/i;
const pizzaSliceUnitRegex = /\b(?:slice|slices)\b/i;
const genericFallbackNameRegex = /\b(?:estimated mixed meal|mixed meal|meal item|unknown food)\b/i;
const correctionCueRegex = /^(?:actually|no|nah|i meant|make that|change (?:it|that|this)|update (?:it|that|this)|instead|not )\b/i;
const discourseFoodBlockerRegex = /\b(?:actually|make that|instead(?: of)?|what should i eat|what should i have|tonight|add that|change it|change that|remove|keep|also|btw|wym|what do you mean)\b/i;
const strongFoodSignalRegex = /\b(?:blueberr(?:y|ies)|greek yogurt|cottage cheese|rice cakes?|peanut butter|toast|eggs?|bacon|orange juice|hash browns?|pizza|little caesars?|chipotle|wendy'?s|sandwich|fries|fairlife|core power|pickles?|bananas?|apples?|protein bars?|protein shake|shakes?|turkey sausage|sausage|coke zero|soda|chips?|guac(?:amole)?)\b/i;

const emptyContext: MealAssistantContext = {
  favoriteMeals: [],
  recentMeals: [],
  assistantMemory: undefined,
  nutritionPreferences: null,
  proteinGoal: null,
  dailyCalorieGoal: null,
  todayProtein: null,
  todayCarbs: null,
  todayFat: null,
  todayCalories: null,
  remainingProtein: null,
  remainingCarbs: null,
  remainingFat: null,
  remainingCalories: null,
  todayMealCount: null,
};

type MealAssistantRunInput = {
  message: string;
  state: MealAssistantState;
  context?: MealAssistantContext;
  userPreferences?: string | null;
  conversationHistory?: MealAssistantTranscriptMessage[];
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

type MixedIntentSplit = {
  foodMessage: string | null;
  followUpMessage: string | null;
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

function normalizeKnownFoodTypos(text: string) {
  return text
    .replace(/\bcotaage\b/g, 'cottage')
    .replace(/\bcotage\b/g, 'cottage')
    .replace(/\bcottagee\b/g, 'cottage')
    .replace(/\bceasers\b/g, 'caesars')
    .replace(/\bcaesers\b/g, 'caesars');
}

function normalizeFoodText(text: string) {
  return normalizeKnownFoodTypos(normalizeText(text));
}

function sanitizeAssistantText(text: string) {
  return text
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u20ac\u201c/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-');
}

function shorten(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function tokenizeText(text: string) {
  return normalizeFoodText(text)
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
  return items.map((item) => formatParsedItemLabel(item)).join(', ');
}

function buildHumanFoodNameFromAssistantItem(item: MealAssistantItem) {
  const brand = item.brand?.trim() ? `${item.brand.trim()} ` : '';
  const modifiers = item.modifiers.length ? `${item.modifiers.join(' ')} ` : '';
  return `${brand}${modifiers}${item.name}`
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasStrongFoodSignal(text: string) {
  return strongFoodSignalRegex.test(normalizeKnownFoodTypos(text.toLowerCase()));
}

function isNonFoodDialogueMessage(message: string) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  return (
    recommendationRegex.test(normalized) ||
    lighterVersionRegex.test(normalized) ||
    sweetHealthyRegex.test(normalized) ||
    healthyTreatRegex.test(normalized) ||
    followUpMacroRegex.test(normalized) ||
    calorieLeftRegex.test(normalized) ||
    proteinLeftRegex.test(normalized) ||
    onTrackRegex.test(normalized) ||
    comparisonRegex.test(normalized) ||
    weeklySummaryRegex.test(normalized) ||
    snackRoomRegex.test(normalized) ||
    casualRegex.test(normalized) ||
    offTopicRegex.test(normalized) ||
    jokeRequestRegex.test(normalized) ||
    (isQuestionLikeText(normalized) && !hasStrongFoodSignal(normalized))
  );
}

function looksLikeRawConversationalFoodText(foodText: string, message: string) {
  const normalizedFood = normalizeFoodText(foodText);
  const normalizedMessage = normalizeFoodText(message);

  if (!normalizedFood) {
    return true;
  }

  if (isNonFoodDialogueMessage(message)) {
    return true;
  }

  if (normalizedFood === normalizedMessage && discourseFoodBlockerRegex.test(message)) {
    return true;
  }

  if (correctionCueRegex.test(normalizedFood) || /^(?:what|how|why|when|where|who|should|would|can|do|did)\b/.test(normalizedFood)) {
    return true;
  }

  const tokenCount = normalizedFood.split(/\s+/).filter(Boolean).length;
  return tokenCount > 8 && discourseFoodBlockerRegex.test(normalizedFood);
}

function isUnsafeLookupItem(item: MealAssistantItem, message: string) {
  const foodText = buildHumanFoodNameFromAssistantItem(item);
  return looksLikeRawConversationalFoodText(foodText, message);
}
function buildPizzaSliceEstimate(item: MealAssistantItem): ParsedFoodItem {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const perSlice = {
    calories: 285,
    protein: 12,
    carbs: 36,
    fat: 10,
    fiber: 2,
    sugar: 3,
    sodium: 640,
  };

  return {
    food_name: 'slices of pizza',
    quantity,
    unit: quantity === 1 ? 'slice' : 'slices',
    calories: Math.round(perSlice.calories * quantity),
    protein: Math.round(perSlice.protein * quantity),
    carbs: Math.round(perSlice.carbs * quantity),
    fat: Math.round(perSlice.fat * quantity),
    fiber: Math.round(perSlice.fiber * quantity),
    sugar: Math.round(perSlice.sugar * quantity),
    sodium: Math.round(perSlice.sodium * quantity),
    notes: 'Generic pizza estimate based on standard cheese/pepperoni-style slices; exact calories can vary by size, crust, and toppings.',
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'Calorie Compass generic pizza estimate',
    confidence_label: 'Estimated',
    matched_query: buildItemLookupText(item),
    original_user_text: buildItemLookupText(item),
    provider_used: null,
    used_ai_fallback: true,
    catalog_food_id: null,
  };
}

function repairResolvedNutritionItem(item: MealAssistantItem, resolvedItem: ParsedFoodItem): ParsedFoodItem {
  const lookupText = buildItemLookupText(item);
  const lookupNormalized = normalizeFoodText(lookupText);
  const isPizzaSlices = pizzaNameRegex.test(lookupText) && (pizzaSliceUnitRegex.test(lookupText) || item.quantity >= 2);

  if (isPizzaSlices) {
    const resolvedCalories = Number(resolvedItem.calories || 0);
    const caloriesLookTooLow = item.quantity >= 2 && resolvedCalories < item.quantity * 180;
    const genericName = genericResolvedFoodRegex.test(resolvedItem.food_name.trim());

    if (genericName || caloriesLookTooLow) {
      return buildPizzaSliceEstimate(item);
    }
  }

  if (/\btoast\b/.test(lookupNormalized) && /\bbread\b/i.test(resolvedItem.food_name.trim())) {
    return {
      ...resolvedItem,
      food_name: 'Toast',
      quantity: item.quantity || resolvedItem.quantity,
      unit: item.unit?.trim() || (item.quantity === 1 ? 'slice' : 'slices'),
      matched_query: resolvedItem.matched_query ?? lookupText,
      original_user_text: resolvedItem.original_user_text ?? lookupText,
      source_type: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? 'AI_ESTIMATE' : resolvedItem.source_type,
      source_name: resolvedItem.source_name ?? 'Toast common serving estimate',
      confidence_label: resolvedItem.confidence_label ?? 'Estimated',
      is_trusted: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? false : resolvedItem.is_trusted,
      used_ai_fallback: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? true : resolvedItem.used_ai_fallback,
    };
  }

  if (genericResolvedFoodRegex.test(resolvedItem.food_name.trim())) {
    const humanName = buildHumanFoodNameFromAssistantItem(item);
    if (humanName) {
      return {
        ...resolvedItem,
        food_name: humanName,
        quantity: item.quantity || resolvedItem.quantity,
        unit: item.unit?.trim() || resolvedItem.unit,
        matched_query: resolvedItem.matched_query ?? lookupText,
        original_user_text: resolvedItem.original_user_text ?? lookupText,
      };
    }
  }

  if (item.quantity > 1 && /^rice cake$/i.test(resolvedItem.food_name.trim())) {
    return {
      ...resolvedItem,
      food_name: 'rice cakes',
      quantity: item.quantity || resolvedItem.quantity,
      unit: item.unit?.trim() || resolvedItem.unit,
      matched_query: resolvedItem.matched_query ?? lookupText,
      original_user_text: resolvedItem.original_user_text ?? lookupText,
    };
  }

  return resolvedItem;
}

type GenericEstimateSpec = {
  key: string;
  label: string;
  unit: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  sourceName?: string;
  sourceType?: ParsedFoodItem['source_type'];
  notes?: string;
};

function formatDisplayQuantity(quantity: number) {
  return Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
}

function formatUnitForQuantity(unit: string, quantity: number) {
  const normalized = unit.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') {
    return 'g';
  }

  if (normalized === 'slice' || normalized === 'slices') {
    return quantity === 1 ? 'slice' : 'slices';
  }

  if (normalized === 'piece' || normalized === 'pieces') {
    return quantity === 1 ? 'piece' : 'pieces';
  }

  if (normalized.endsWith('s') && quantity === 1) {
    return normalized.slice(0, -1);
  }

  if (!normalized.endsWith('s') && quantity !== 1 && !['oz', 'tbsp'].includes(normalized)) {
    return `${normalized}s`;
  }

  return normalized;
}

function formatParsedItemLabel(item: ParsedFoodItem) {
  const quantity = formatDisplayQuantity(item.quantity);
  const unit = item.unit?.trim() ?? '';
  const normalizedUnit = formatUnitForQuantity(unit, item.quantity);
  const normalizedFoodName = normalizeText(item.food_name);

  if (!normalizedUnit || ['serving', 'servings', 'meal', 'meals', 'count', 'counts'].includes(normalizedUnit)) {
    return `${quantity} ${item.food_name}`;
  }

  if (normalizedUnit === 'g') {
    return `${quantity}g ${item.food_name}`;
  }

  if (normalizedFoodName.includes(normalizeText(normalizedUnit)) || normalizedFoodName.includes(normalizeText(unit))) {
    return `${quantity} ${item.food_name}`;
  }

  if (['slice', 'slices', 'piece', 'pieces'].includes(normalizedUnit)) {
    return `${quantity} ${normalizedUnit} of ${item.food_name}`;
  }

  return `${quantity} ${normalizedUnit} ${item.food_name}`;
}

function makeGenericEstimate(spec: GenericEstimateSpec, originalText: string): ParsedFoodItem {
  const sourceType = spec.sourceType ?? 'AI_ESTIMATE';
  const isTrusted = sourceType !== 'AI_ESTIMATE';

  return {
    food_name: spec.label,
    quantity: spec.quantity,
    unit: spec.unit,
    calories: Number(spec.calories.toFixed(1)),
    protein: Number(spec.protein.toFixed(1)),
    carbs: Number(spec.carbs.toFixed(1)),
    fat: Number(spec.fat.toFixed(1)),
    fiber: Number((spec.fiber ?? 0).toFixed(1)),
    sugar: Number((spec.sugar ?? 0).toFixed(1)),
    sodium: Number((spec.sodium ?? 0).toFixed(1)),
    notes: spec.notes ?? (isTrusted ? `Matched from ${spec.sourceName ?? 'trusted nutrition reference'}.` : 'Fallback estimate from common nutrition references. Confirm details if needed.'),
    is_trusted: isTrusted,
    source_type: sourceType,
    source_name: spec.sourceName ?? 'Calorie Compass common-food fallback',
    confidence_label: sourceType === 'OFFICIAL_RESTAURANT' ? 'Verified' : sourceType === 'GENERIC_REFERENCE' ? 'High confidence' : 'Estimated',
    matched_query: spec.key,
    original_user_text: originalText,
    provider_used: sourceType === 'OFFICIAL_RESTAURANT' ? 'local-verified-catalog' : sourceType === 'GENERIC_REFERENCE' ? 'database-match' : null,
    used_ai_fallback: !isTrusted,
    catalog_food_id: null,
  };
}

function dedupeParsedItems(items: ParsedFoodItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(`${item.food_name}:${item.unit}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getKnownItemOrderIndex(item: ParsedFoodItem, normalizedMessage: string) {
  const candidates = [
    item.matched_query,
    item.food_name,
    /\bwendy/i.test(item.food_name) && /sandwich/i.test(item.food_name) ? 'spicy chicken sandwich' : null,
    /\bfries?\b/i.test(item.food_name) ? 'medium fries' : null,
    /\bfairlife|core power/i.test(item.food_name) ? 'fairlife core power elite' : null,
    /\bcoke zero/i.test(item.food_name) ? 'coke zero' : null,
    /\bchipotle/i.test(item.food_name) ? 'chipotle' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeFoodText);

  const found = candidates
    .map((candidate) => normalizedMessage.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return found ?? Number.MAX_SAFE_INTEGER;
}

function sortKnownEstimateItems(items: ParsedFoodItem[], message: string) {
  const normalizedMessage = normalizeFoodText(message);
  return [...items].sort((left, right) => getKnownItemOrderIndex(left, normalizedMessage) - getKnownItemOrderIndex(right, normalizedMessage));
}

function detectKnownFoodEstimates(message: string): ParsedFoodItem[] {
  const normalized = normalizeFoodText(message);
  const lower = normalizeKnownFoodTypos(message.toLowerCase());
  const items: ParsedFoodItem[] = [];
  const countWordPattern = 'one|two|three|four|five|six|seven|eight|nine|ten';
  const readCountBefore = (pattern: string, fallback = 1) => {
    const match = normalized.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${countWordPattern})\\s+${pattern}\\b`));
    return match ? parseCount(match[1] ?? '1') : fallback;
  };

  const chipotleEstimate = detectChipotleBowlEstimate(message);
  if (chipotleEstimate) {
    items.push(chipotleEstimate);
  }

  const sliceMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+(?:slices?|pieces?)\s+(?:of\s+)?(?:little caesars\s+)?(?:pizza|pepperoni pizza|cheese pizza)\b/);
  const wordSliceMatch = normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:slices?|pieces?)\s+(?:of\s+)?(?:little caesars\s+)?(?:pizza|pepperoni pizza|cheese pizza)\b/);
  const pizzaQuantity = sliceMatch ? Number(sliceMatch[1]) : wordSliceMatch ? parseCount(wordSliceMatch[1] ?? '1') : null;

  if (pizzaQuantity) {
    const isLittleCaesars = /\blittle caesars?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'slices of pizza',
          quantity: pizzaQuantity,
          unit: pizzaQuantity === 1 ? 'slice' : 'slices',
          calories: pizzaQuantity * 285,
          protein: pizzaQuantity * 12,
          carbs: pizzaQuantity * 36,
          fat: pizzaQuantity * 10,
          fiber: pizzaQuantity * 2,
          sugar: pizzaQuantity * 4,
          sodium: pizzaQuantity * 640,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic pizza slice fallback estimate',
        },
        message,
      ),
    );
  }

  if (!pizzaQuantity && /\b(?:a\s+)?(?:whole|entire)\s+(?:little caesars\s+|cheese\s+|pepperoni\s+)?(?:pizza|pie)\b/.test(normalized)) {
    const isLittleCaesars = /\blittle caesars?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'whole pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
          quantity: 1,
          unit: 'pizza',
          calories: 2280,
          protein: 96,
          carbs: 288,
          fat: 80,
          fiber: 16,
          sugar: 32,
          sodium: 5120,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic whole pizza fallback estimate',
        },
        message,
      ),
    );
  }

  if (/\bblueberr(?:y|ies)\b/.test(normalized)) {
    const quantity = /\b(?:some|handful)\b/.test(normalized) ? 0.5 : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'blueberries',
          label: 'Blueberries',
          quantity,
          unit: 'cup',
          calories: quantity * 85,
          protein: quantity * 1,
          carbs: quantity * 21,
          fat: quantity * 0.5,
          fiber: quantity * 3.5,
          sugar: quantity * 15,
          sodium: quantity * 1,
        },
        message,
      ),
    );
  }

  if (/\bgreek yogurt\b/.test(normalized)) {
    const isPlain = /\bplain\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'greek yogurt',
          label: isPlain ? 'Plain Greek yogurt' : 'Greek yogurt',
          quantity: 1,
          unit: 'serving',
          calories: 100,
          protein: 17,
          carbs: 6,
          fat: 0.5,
          sugar: 6,
          sodium: 65,
        },
        message,
      ),
    );
  }

  if (/\beggs?\b/.test(normalized)) {
    const quantity = readCountBefore('(?:scrambled\\s+|fried\\s+|hard boiled\\s+)?eggs?', 1);
    const isScrambled = /\bscrambled eggs?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'eggs',
          label: isScrambled ? 'Scrambled eggs' : 'Eggs',
          quantity,
          unit: quantity === 1 ? 'egg' : 'eggs',
          calories: quantity * 70,
          protein: quantity * 6,
          carbs: quantity * 0.5,
          fat: quantity * 5,
          sodium: quantity * 70,
          sourceName: 'Egg common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\btoast\b/.test(normalized)) {
    const quantity = readCountBefore('(?:(?:slices?|pieces?)\\s+(?:of\\s+)?)?toast', 1);
    const isButtered = /\bbuttered toast\b|\btoast with butter\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'toast',
          label: isButtered ? 'Buttered toast' : 'Toast',
          quantity,
          unit: quantity === 1 ? 'slice' : 'slices',
          calories: quantity * (isButtered ? 150 : 100),
          protein: quantity * 4,
          carbs: quantity * 19,
          fat: quantity * (isButtered ? 6 : 1),
          fiber: quantity * 1.5,
          sugar: quantity * 2,
          sodium: quantity * (isButtered ? 190 : 150),
          sourceName: 'Toast common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bturkey sausage\b/.test(normalized)) {
    const quantity = readCountBefore('(?:turkey\\s+)?sausage(?:\\s+links?|\\s+patties?)?', 2);
    items.push(
      makeGenericEstimate(
        {
          key: 'turkey sausage',
          label: 'Turkey sausage',
          quantity,
          unit: quantity === 1 ? 'link' : 'links',
          calories: quantity * 70,
          protein: quantity * 6,
          carbs: quantity * 1,
          fat: quantity * 4.5,
          sodium: quantity * 260,
          sourceName: 'Turkey sausage common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bcoke zero\b|\bzero sugar coke\b|\bdiet coke\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'coke zero',
          label: 'Coke Zero',
          quantity: 1,
          unit: 'can',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          sugar: 0,
          sodium: 40,
          sourceName: 'Coca-Cola nutrition reference',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bbacon\b/.test(normalized)) {
    const quantity = readCountBefore('(?:slices?\\s+of\\s+)?bacon', 2);
    items.push(
      makeGenericEstimate(
        {
          key: 'bacon',
          label: 'Bacon',
          quantity,
          unit: quantity === 1 ? 'slice' : 'slices',
          calories: quantity * 45,
          protein: quantity * 3,
          carbs: 0,
          fat: quantity * 3.5,
          sodium: quantity * 180,
          sourceName: 'Bacon common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\borange juice\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'orange juice',
          label: 'Orange juice',
          quantity: 1,
          unit: 'glass',
          calories: 110,
          protein: 2,
          carbs: 26,
          fat: 0,
          sugar: 21,
          sodium: 10,
          sourceName: 'Orange juice common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bhash browns?\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'hash browns',
          label: 'Hash browns',
          quantity: 1,
          unit: 'serving',
          calories: 180,
          protein: 2,
          carbs: 24,
          fat: 8,
          fiber: 2,
          sugar: 0,
          sodium: 320,
          sourceName: 'Hash browns common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\b(?:wendys|wendy s)\b/.test(normalized) && /\bspicy chicken sandwich\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'wendys spicy chicken sandwich',
          label: "Wendy's Spicy Chicken Sandwich",
          quantity: 1,
          unit: 'sandwich',
          calories: 490,
          protein: 28,
          carbs: 49,
          fat: 21,
          fiber: 2,
          sugar: 6,
          sodium: 1080,
          sourceName: "Wendy's official nutrition",
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (/\b(?:wendys|wendy s)\b/.test(normalized) && /\bfries?\b/.test(normalized)) {
    const isMedium = /\bmedium\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'wendys fries',
          label: isMedium ? "Wendy's medium fries" : "Wendy's fries",
          quantity: 1,
          unit: isMedium ? 'medium order' : 'order',
          calories: isMedium ? 350 : 320,
          protein: isMedium ? 5 : 4,
          carbs: isMedium ? 48 : 43,
          fat: isMedium ? 16 : 15,
          fiber: 5,
          sugar: 0,
          sodium: isMedium ? 520 : 470,
          sourceName: "Wendy's fries common serving estimate",
        },
        message,
      ),
    );
  }

  if (/\bchips?\b/.test(normalized) && /\bguac(?:amole)?\b/.test(normalized)) {
    const isChipotle = /\bchipotle\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'chips with guacamole',
          label: isChipotle ? 'Chipotle chips with guacamole' : 'Chips with guacamole',
          quantity: 1,
          unit: 'order',
          calories: 770,
          protein: 8,
          carbs: 81,
          fat: 47,
          fiber: 12,
          sugar: 3,
          sodium: 1130,
          sourceName: isChipotle ? 'Chipotle chips and guacamole estimate' : 'Chips and guacamole common estimate',
        },
        message,
      ),
    );
  }

  if (/\bcottage cheese\b/.test(normalized)) {
    const gramMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/) ?? lower.match(/\b(?:about|around)\s+(\d+(?:\.\d+)?)\b/);
    const grams = gramMatch ? Number(gramMatch[1]) : null;
    const isLowFat = /\blow fat\b|\blowfat\b|\b2%\b/.test(normalized);
    const isDaisy = /\bdaisy\b/.test(normalized);
    const quantity = grams && Number.isFinite(grams) && grams > 0 ? grams : 0.5;
    const unit = grams && Number.isFinite(grams) && grams > 0 ? 'g' : 'cup';
    const multiplier = grams && Number.isFinite(grams) && grams > 0 ? grams / 113 : 1;
    const label = `${isDaisy ? 'Daisy ' : ''}${isLowFat ? 'Low fat ' : ''}cottage cheese`
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

    items.push(
      makeGenericEstimate(
        {
          key: 'cottage cheese',
          label,
          quantity,
          unit,
          calories: 90 * multiplier,
          protein: 13 * multiplier,
          carbs: 4 * multiplier,
          fat: (isLowFat ? 2.5 : 5) * multiplier,
          sugar: 3 * multiplier,
          sodium: 350 * multiplier,
          sourceName: 'Cottage cheese common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bpickles?\b/.test(normalized)) {
    const countMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+pickles?\b/) ?? normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+pickles?\b/);
    const quantity = countMatch ? parseCount(countMatch[1] ?? '1') : 1;

    items.push(
      makeGenericEstimate(
        {
          key: 'pickles',
          label: 'Pickles',
          quantity,
          unit: quantity === 1 ? 'pickle' : 'pickles',
          calories: quantity * 5,
          protein: 0,
          carbs: quantity * 1,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: quantity * 280,
          sourceName: 'Pickle common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bbananas?\b/.test(normalized)) {
    const quantity = readCountBefore('bananas?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'banana',
          label: quantity === 1 ? 'Banana' : 'Bananas',
          quantity,
          unit: quantity === 1 ? 'banana' : 'bananas',
          calories: quantity * 105,
          protein: quantity * 1.3,
          carbs: quantity * 27,
          fat: quantity * 0.4,
          fiber: quantity * 3,
          sugar: quantity * 14,
          sodium: quantity * 1,
          sourceName: 'Banana common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bapples?\b/.test(normalized)) {
    const quantity = readCountBefore('apples?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'apple',
          label: quantity === 1 ? 'Apple' : 'Apples',
          quantity,
          unit: quantity === 1 ? 'apple' : 'apples',
          calories: quantity * 95,
          protein: quantity * 0.5,
          carbs: quantity * 25,
          fat: quantity * 0.3,
          fiber: quantity * 4,
          sugar: quantity * 19,
          sodium: quantity * 2,
          sourceName: 'Apple common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bpeanut butter\b/.test(normalized)) {
    const tbspMatch = normalized.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:tbsp|tablespoons?)\s+(?:of\s+)?peanut butter\b/);
    const quantity = tbspMatch ? parseCount(tbspMatch[1] ?? '1') : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'peanut butter',
          label: 'Peanut butter',
          quantity,
          unit: quantity === 1 ? 'tbsp' : 'tbsp',
          calories: quantity * 95,
          protein: quantity * 4,
          carbs: quantity * 3,
          fat: quantity * 8,
          fiber: quantity * 1,
          sugar: quantity * 1,
          sodium: quantity * 75,
          sourceName: 'Peanut butter common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\brice cakes?\b/.test(normalized)) {
    const quantity = readCountBefore('rice cakes?', 1);
    const isQuaker = /\bquaker\b/.test(normalized);
    const isWhiteCheddar = /\bwhite cheddar\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'rice cakes',
          label: `${isQuaker ? 'Quaker ' : ''}${isWhiteCheddar ? 'White cheddar ' : ''}rice cakes`.replace(/^./, (char) => char.toUpperCase()),
          quantity,
          unit: quantity === 1 ? 'cake' : 'cakes',
          calories: quantity * (isWhiteCheddar ? 45 : 35),
          protein: quantity * 1,
          carbs: quantity * (isWhiteCheddar ? 9 : 7),
          fat: quantity * (isWhiteCheddar ? 1.5 : 0),
          fiber: quantity * 0.5,
          sodium: quantity * (isWhiteCheddar ? 100 : 15),
          sourceName: isQuaker ? 'Quaker-style rice cake estimate' : 'Rice cake common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\b(?:fairlife|core power|protein shake|shake)\b/.test(normalized) && /\b(?:shake|core power|fairlife)\b/.test(normalized)) {
    const isElite = /\belite\b|\b42g\b|\b42\s*(?:gram|grams|g)\b/.test(normalized);
    const isFairlife = /\bfairlife\b|\bcore power\b/.test(normalized);
    const isChocolate = /\bchocolate\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: isElite ? 'fairlife core power elite' : 'protein shake',
          label: isElite
            ? 'Fairlife Core Power Elite 42g Protein Shake'
            : isFairlife
              ? `Fairlife ${isChocolate ? 'chocolate ' : ''}protein shake`
              : 'Protein shake',
          quantity: 1,
          unit: 'bottle',
          calories: isElite ? 230 : 150,
          protein: isElite ? 42 : 30,
          carbs: isElite ? 8 : 4,
          fat: isElite ? 3.5 : 2.5,
          fiber: isElite ? 1 : 0,
          sugar: isElite ? 7 : 2,
          sodium: isElite ? 260 : 180,
          sourceName: isFairlife ? 'Fairlife nutrition reference' : 'Protein shake common serving estimate',
          sourceType: isFairlife ? 'GENERIC_REFERENCE' : 'AI_ESTIMATE',
        },
        message,
      ),
    );
  }

  if (/\bprotein bars?\b/.test(normalized)) {
    const quantity = readCountBefore('protein bars?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'protein bar',
          label: quantity === 1 ? 'Protein bar' : 'Protein bars',
          quantity,
          unit: quantity === 1 ? 'bar' : 'bars',
          calories: quantity * 200,
          protein: quantity * 20,
          carbs: quantity * 22,
          fat: quantity * 7,
          fiber: quantity * 5,
          sugar: quantity * 4,
          sodium: quantity * 180,
          sourceName: 'Protein bar common serving estimate',
        },
        message,
      ),
    );
  }

  return sortKnownEstimateItems(dedupeParsedItems(items), message);
}

function resolvePizzaClarificationEstimate(message: string, state: MealAssistantState): ParsedFoodItem[] {
  const pendingQuestion = `${state.pendingClarification ?? ''} ${state.lastAssistantQuestion ?? ''}`;
  const normalizedPendingQuestion = normalizeFoodText(pendingQuestion);
  if (!/\bpizza\b/.test(normalizedPendingQuestion)) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  const isLittleCaesars = /\blittle caesars?\b/.test(normalizedPendingQuestion);

  if (
    /^(?:a |the )?(?:whole|entire) (?:little caesars |cheese |pepperoni )?(?:pizza|pie)$/.test(normalized) ||
    /\b(?:whole|entire) (?:little caesars |cheese |pepperoni )?(?:pizza|pie)\b/.test(normalized)
  ) {
    return [
      makeGenericEstimate(
        {
          key: 'whole pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
          quantity: 1,
          unit: 'pizza',
          calories: 2280,
          protein: 96,
          carbs: 288,
          fat: 80,
          fiber: 16,
          sugar: 32,
          sodium: 5120,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic whole pizza fallback estimate',
        },
        `${isLittleCaesars ? 'whole Little Caesars pizza' : 'whole pizza'}`,
      ),
    ];
  }

  const countMatch = normalized.match(/^(?:about |around )?(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?: slices?| pieces?)?$/);
  if (!countMatch) {
    return [];
  }

  const quantity = parseCount(countMatch[1] ?? '1');

  return [
    makeGenericEstimate(
      {
        key: 'pizza',
        label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
        quantity,
        unit: quantity === 1 ? 'slice' : 'slices',
        calories: quantity * 285,
        protein: quantity * 12,
        carbs: quantity * 36,
        fat: quantity * 10,
        fiber: quantity * 2,
        sugar: quantity * 4,
        sodium: quantity * 640,
        sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic pizza slice fallback estimate',
      },
      `${quantity} ${quantity === 1 ? 'slice' : 'slices'} of ${isLittleCaesars ? 'Little Caesars ' : ''}pizza`,
    ),
  ];
}

function detectChipotleBowlEstimate(message: string): ParsedFoodItem | null {
  const normalized = normalizeText(message);
  if (!/\bchipotle\b/.test(normalized)) {
    return null;
  }

  const components: string[] = [];
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let sodium = 0;

  const add = (label: string, values: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number; sodium?: number }) => {
    components.push(label);
    calories += values.calories;
    protein += values.protein;
    carbs += values.carbs;
    fat += values.fat;
    fiber += values.fiber ?? 0;
    sugar += values.sugar ?? 0;
    sodium += values.sodium ?? 0;
  };

  if (/\bwhite rice\b/.test(normalized)) add('white rice', { calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sodium: 350 });
  else if (/\bbrown rice\b/.test(normalized)) add('brown rice', { calories: 210, protein: 4, carbs: 36, fat: 6, fiber: 2, sodium: 190 });
  else if (/\brice\b/.test(normalized)) add('rice', { calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sodium: 350 });

  if (/\bdouble chicken\b/.test(normalized)) add('double chicken', { calories: 360, protein: 64, carbs: 0, fat: 14, sodium: 620 });
  else if (/\bchicken\b/.test(normalized)) add('chicken', { calories: 180, protein: 32, carbs: 0, fat: 7, sodium: 310 });

  if (/\bcheese\b/.test(normalized)) add('cheese', { calories: 110, protein: 6, carbs: 1, fat: 8, sodium: 190 });
  if (/\bcorn(?: salsa)?\b/.test(normalized)) add('corn salsa', { calories: 80, protein: 3, carbs: 16, fat: 1.5, fiber: 3, sugar: 4, sodium: 330 });
  if (/\blettuce\b/.test(normalized)) add('lettuce', { calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sodium: 0 });
  if (/\bgreen salsa\b|\btomatillo green\b/.test(normalized)) add('green salsa', { calories: 15, protein: 0, carbs: 4, fat: 0, fiber: 1, sugar: 2, sodium: 260 });
  if (/\bblack beans\b/.test(normalized)) add('black beans', { calories: 130, protein: 8, carbs: 22, fat: 1.5, fiber: 8, sodium: 210 });
  if (/\bpinto beans\b/.test(normalized)) add('pinto beans', { calories: 130, protein: 8, carbs: 21, fat: 1.5, fiber: 8, sodium: 210 });
  if (/\bfajita(?: veggies| vegetables)?\b/.test(normalized)) add('fajita veggies', { calories: 20, protein: 1, carbs: 5, fat: 0, fiber: 2, sodium: 170 });
  if (/\bsour cream\b/.test(normalized)) add('sour cream', { calories: 110, protein: 2, carbs: 2, fat: 9, sodium: 30 });
  if (/\bguac(?:amole)?\b/.test(normalized)) add('guacamole', { calories: 230, protein: 2, carbs: 8, fat: 22, fiber: 6, sodium: 370 });

  if (components.length < 2) {
    return null;
  }

  return makeGenericEstimate(
    {
      key: 'chipotle bowl',
      label: `Chipotle bowl with ${components.join(', ')}`,
      quantity: 1,
      unit: 'bowl',
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      sourceName: 'Chipotle official nutrition',
      sourceType: 'OFFICIAL_RESTAURANT',
      notes: 'Built from Chipotle official component nutrition. Adjust if portions or toppings differ.',
    },
    message,
  );
}

function itemTextForCoverage(items: ParsedFoodItem[]) {
  return normalizeText(items.map((item) => [item.food_name, item.matched_query, item.original_user_text, item.notes].filter(Boolean).join(' ')).join(' '));
}

function itemCoversTerm(items: ParsedFoodItem[], term: string) {
  const haystack = itemTextForCoverage(items);
  return normalizeText(term)
    .split(' ')
    .every((token) => haystack.includes(token));
}

function shouldTryOnlineHydration(item: ParsedFoodItem) {
  if (process.env.NODE_ENV === 'test' && !process.env.USDA_FDC_API_KEY && !process.env.FDC_API_KEY) {
    return false;
  }

  return (
    item.source_type === 'AI_ESTIMATE' &&
    !/\b(?:pizza|little caesars|chipotle bowl|wendy|coke zero|rice cakes?|blueberries|greek yogurt|peanut butter|hash browns?|turkey sausage|fairlife|core power|chips with guac|chips with guacamole)\b/i.test(`${item.food_name} ${item.source_name ?? ''}`)
  );
}

function isNoisyHydrationMatch(originalItem: ParsedFoodItem, resolvedItem: ParsedFoodItem) {
  const original = normalizeFoodText(`${originalItem.food_name} ${originalItem.original_user_text ?? ''}`);
  const resolved = normalizeFoodText(`${resolvedItem.food_name} ${resolvedItem.matched_query ?? ''} ${resolvedItem.notes ?? ''}`);
  const addedQualifierTerms = ['oats', 'granola', 'strawberry', 'strawberries', 'banana', 'chocolate', 'honey', 'fruit', 'vegetable', 'vegetables'];

  if (!original || !resolved) {
    return false;
  }

  return addedQualifierTerms.some((term) => resolved.includes(term) && !original.includes(term));
}

function buildKnownEstimateLookupText(item: ParsedFoodItem) {
  const quantity = formatDisplayQuantity(item.quantity);
  const unit = item.unit?.trim() ?? '';

  if (unit && !/^(?:serving|servings|meal|meals|count|counts)$/i.test(unit)) {
    return `${quantity} ${unit} ${item.food_name}`.replace(/\s+/g, ' ').trim();
  }

  return `${quantity} ${item.food_name}`.replace(/\s+/g, ' ').trim();
}

async function hydrateKnownEstimatesWithProviders(items: ParsedFoodItem[], mealType: MealAssistantState['mealType']) {
  const hydrated: ParsedFoodItem[] = [];

  for (const item of items) {
    if (!shouldTryOnlineHydration(item)) {
      hydrated.push(item);
      continue;
    }

    const resolved = await resolveNutritionEstimate({
      text: buildKnownEstimateLookupText(item),
      mealType,
    });
    const resolvedItem = resolved?.items[0] ?? null;

    if (resolvedItem && itemCoversTerm([resolvedItem], item.food_name) && !isNoisyHydrationMatch(item, resolvedItem)) {
      hydrated.push(resolvedItem);
      continue;
    }

    hydrated.push(item);
  }

  return hydrated;
}

function messageHasRestaurantCue(message: string) {
  return /\b(?:chick\s*fil\s*a|chickfila|chipotle|mcdonalds?|mcdonald s|taco bell|starbucks|wendys|wendy s|panera|subway|cava|panda express|little caesars?)\b/.test(normalizeFoodText(message));
}

function shouldAskPizzaPortion(message: string, items: MealAssistantItem[]) {
  const normalized = normalizeFoodText(message);
  if (!/\bpizza\b/.test(normalized)) {
    return false;
  }
  if (/\b\d+(?:\.\d+)?\s+(?:slices?|pieces?)\b/.test(normalized)) {
    return false;
  }
  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:slices?|pieces?)\b/.test(normalized)) {
    return false;
  }
  if (/\b(?:whole|entire)\s+(?:little caesars\s+|cheese\s+|pepperoni\s+)?(?:pizza|pie)\b/.test(normalized)) {
    return false;
  }
  return items.length <= 1;
}

function buildPizzaPortionQuestion(message: string) {
  const normalized = normalizeFoodText(message);
  if (/\blittle caesars?\b/.test(normalized)) {
    return 'For Little Caesars, was that one slice, a few slices, or a whole pizza?';
  }
  return 'How much pizza should I log, one slice, a few slices, or a whole pizza?';
}

function cleanOriginalFoodName(message: string) {
  return cleanMealReferenceText(stripEmotionalPreface(message)).replace(/^(?:log|add|track)\s+/i, '').replace(/\s+/g, ' ').trim() || 'Estimated food';
}

function isBadGenericResolvedItem(item: ParsedFoodItem) {
  return genericFallbackNameRegex.test(item.food_name) || (item.source_type === 'AI_ESTIMATE' && item.calories === 520 && item.protein === 30 && item.carbs === 45 && item.fat === 20);
}

function hardenResolvedItems(args: { message: string; resolvedItems: ParsedFoodItem[] }) {
  const { message, resolvedItems } = args;
  const chipotleEstimate = detectChipotleBowlEstimate(message);
  if (chipotleEstimate && (resolvedItems.length !== 1 || !/chipotle bowl/i.test(resolvedItems[0]?.food_name ?? ''))) {
    return [chipotleEstimate];
  }

  let nextItems = [...resolvedItems];
  const knownEstimates = detectKnownFoodEstimates(message);

  if (nextItems.some(isBadGenericResolvedItem)) {
    nextItems = [];
  }

  if (knownEstimates.length && !messageHasRestaurantCue(message)) {
    nextItems = nextItems.filter(
      (item) =>
        item.source_type !== 'OFFICIAL_RESTAURANT' ||
        knownEstimates.some((estimate) => itemCoversTerm([item], estimate.food_name)),
    );
  }

  if (knownEstimates.some((estimate) => /\btoast\b/i.test(estimate.food_name))) {
    nextItems = nextItems.filter((item) => !/\bbread\b/i.test(item.food_name) || itemCoversTerm([item], 'toast'));
  }

  if (knownEstimates.some((estimate) => /\bpizza\b/i.test(estimate.food_name)) && !/\b(?:bread|breadsticks?|toast)\b/i.test(message)) {
    nextItems = nextItems.filter((item) => itemCoversTerm([item], 'pizza'));
  }

  for (const estimate of knownEstimates) {
    if (!itemCoversTerm(nextItems, estimate.food_name)) {
      nextItems.push(estimate);
    }
  }

  if (!nextItems.length && knownEstimates.length) {
    nextItems = knownEstimates;
  }

  if (nextItems.length === 1 && isBadGenericResolvedItem(nextItems[0])) {
    nextItems = [
      {
        ...nextItems[0],
        food_name: cleanOriginalFoodName(message),
        original_user_text: message,
        source_type: 'AI_ESTIMATE',
        source_name: 'Calorie Compass guarded fallback',
        confidence_label: 'Estimated',
        is_trusted: false,
        used_ai_fallback: true,
      },
    ];
  }

  if (
    nextItems.length === 1
    && /\bwith\b|\band\b|,/.test(message)
    && !continuationRegex.test(message.trim())
    && !itemCoversTerm(nextItems, cleanOriginalFoodName(message))
  ) {
    const only = nextItems[0];
    if (!/\b(?:chipotle|pizza|bowl|meal|with)\b/i.test(only.food_name)) {
      nextItems = [
        {
          ...only,
          food_name: cleanOriginalFoodName(message),
          original_user_text: message,
          source_type: only.source_type === 'OFFICIAL_RESTAURANT' ? only.source_type : 'AI_ESTIMATE',
          source_name: only.source_name ?? 'Calorie Compass guarded fallback',
          confidence_label: only.confidence_label ?? 'Estimated',
        },
      ];
    }
  }

  return dedupeParsedItems(nextItems);
}

function buildFoodAwareFallbackReply(message: string, items: ParsedFoodItem[]) {
  const cleaned = cleanOriginalFoodName(message);

  if (!items.length) {
    if (/\bpizza\b/i.test(message)) {
      return buildPizzaPortionQuestion(message);
    }
    return `I can log ${cleaned}, but I need a little more detail for a reliable estimate.`;
  }

  const totalCalories = Math.round(sumTotals(items).calories);
  const foodLabel = items.length === 1 ? formatParsedItemLabel(items[0]) : items.map((item) => item.food_name).join(' and ');
  const sourceLabel = items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')
    ? 'Verified match'
    : items.some((item) => item.source_type && item.source_type !== 'AI_ESTIMATE')
      ? 'Part verified, part estimated'
      : 'Estimated';
  return `${foodLabel}, about ${totalCalories} calories total. ${sourceLabel}.`;
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

function stripEmotionalPreface(text: string) {
  return text.trim().replace(/^(?:ugh|oops|sorry|my bad|whoops|damn|dang)[\s,!.-]+/i, '').trim();
}

function buildMemoryReference(candidate: Pick<MemoryEntry, 'items' | 'title' | 'rawText'>) {
  const fallback = candidate.items.length === 1 ? candidate.items[0]?.food_name ?? candidate.title : candidate.title;
  return shorten(cleanMealReferenceText(candidate.rawText) || cleanMealReferenceText(candidate.title) || fallback || 'that meal');
}

function getRecentMealOccurredAt(meal: MealAssistantContext['recentMeals'][number]) {
  return meal.date ?? meal.createdAt ?? null;
}

function isQuestionLikeText(text: string) {
  return /^(?:how|what|why|when|where|who|am|is|are|can|should|would|did|do|wait|protein left|calories left|cals left|cal left|tonight idea|dinner idea)\b/i.test(text.trim());
}

function splitMixedIntentMessage(message: string): MixedIntentSplit {
  const trimmed = message.trim();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const firstQuestionIndex = lines.findIndex(isQuestionLikeText);
    const foodLines = firstQuestionIndex >= 0 ? lines.slice(0, firstQuestionIndex) : lines;
    const followUpLines = firstQuestionIndex >= 0 ? lines.slice(firstQuestionIndex) : [];
    const foodMessage = foodLines.join(' and ');
    const followUpMessage = followUpLines.join(' ');
    const leadTokens = tokenizeText(foodMessage);

    if (foodMessage && leadTokens.length && foodLines.every((line) => !isQuestionLikeText(line))) {
      if (!hasStrongFoodSignal(foodMessage) && followUpMessage && isNonFoodDialogueMessage(followUpMessage)) {
        return {
          foodMessage: null,
          followUpMessage: null,
        };
      }

      return {
        foodMessage,
        followUpMessage,
      };
    }
  }

  const match = trimmed.match(/^(.*?)(?:,?\s+(?:and\s+)?(?:also\s+)?)((?:how much|how many|what about|how about|what should|what's|what is|am i|did i|is that|would that|can i|protein left|calories left|cals left|cal left|tonight idea|dinner idea)\b.*)$/i);

  if (!match) {
    return { foodMessage: null, followUpMessage: null };
  }

  const foodMessage = match[1]?.trim() ?? '';
  const followUpMessage = match[2]?.trim() ?? '';

  const leadTokens = tokenizeText(foodMessage);
  if (!leadTokens.length || leadTokens.every((token) => ['how', 'what', 'why', 'when', 'where', 'who', 'am', 'is', 'are', 'can', 'should', 'would', 'did', 'do', 'wait'].includes(token))) {
    return { foodMessage: null, followUpMessage: null };
  }

  if (!foodMessage || !followUpMessage) {
    return { foodMessage: null, followUpMessage: null };
  }

  if (!hasStrongFoodSignal(foodMessage) && isNonFoodDialogueMessage(followUpMessage)) {
    return { foodMessage: null, followUpMessage: null };
  }

  return {
    foodMessage,
    followUpMessage,
  };
}

function isGenericReply(reply: string) {
  return /^(?:got it|okay|alright|makes sense|tell me what you ate|what did you have|send the meal whenever you’re ready|saved\.?)/i.test(reply.trim());
}

function getReplyOpening(reply: string) {
  return normalizeText(reply).split(' ').slice(0, 2).join(' ');
}

function isWeakStandaloneReply(reply: string) {
  return /^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep|yes)[.!]*$/i.test(reply.trim());
}

function startsWithWeakAcknowledgment(reply: string) {
  return /^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep)[,!. ]/i.test(reply.trim());
}

function buildContextualContinuityReply(state: MealAssistantState) {
  const lastItem = state.currentMealItems.at(-1);

  if (lastItem) {
    return `I have ${shorten(lastItem.food_name, 48)} in this meal. Send another item, a correction, or save it when you’re ready.`;
  }

  if (state.pendingClarification) {
    return `I just need one detail: ${state.pendingClarification}`;
  }

  return 'Tell me what you ate and I’ll break it down.';
}

function polishRepeatedOpening(reply: string, state: MealAssistantState) {
  if (!state.lastAssistantReply) {
    return reply;
  }

  const previousOpening = getReplyOpening(state.lastAssistantReply);
  const nextOpening = getReplyOpening(reply);

  if (!previousOpening || previousOpening !== nextOpening) {
    return reply;
  }

  if (isWeakStandaloneReply(reply)) {
    return buildContextualContinuityReply(state);
  }

  if (startsWithWeakAcknowledgment(reply)) {
    return reply.replace(/^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep)[,!. ]+/i, '');
  }

  return reply;
}

function buildCurrentMealMacroReply(message: string, state: MealAssistantState) {
  if (!state.currentMealItems.length) {
    return null;
  }

  const totals = sumTotals(state.currentMealItems);
  const normalized = message.trim().toLowerCase();

  if (carbsQuestionRegex.test(normalized) && (followUpMacroRegex.test(normalized) || /\bhow much|what(?:'s| is)|carbs?\?/i.test(normalized))) {
    return `That meal is sitting around ${Math.round(totals.carbs)}g carbs.`;
  }

  if (fatQuestionRegex.test(normalized) && (followUpMacroRegex.test(normalized) || /\bhow much|what(?:'s| is)|fat\?/i.test(normalized))) {
    return `That meal is around ${Math.round(totals.fat)}g fat.`;
  }

  if (proteinQuestionRegex.test(normalized) && followUpMacroRegex.test(normalized)) {
    return `That meal is around ${Math.round(totals.protein)}g protein.`;
  }

  if (caloriesQuestionRegex.test(normalized) && followUpMacroRegex.test(normalized)) {
    return `That meal is about ${Math.round(totals.calories)} calories.`;
  }

  return null;
}

function buildRecommendationReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const remainingProtein = getRemainingProtein(context);
  const remainingCalories = getRemainingCalories(context);
  const suggestion = findSuggestionCandidate(context, {
    mealType: input.state.mealType,
    maxCalories: remainingCalories !== null && remainingCalories > 0 ? Math.min(remainingCalories, 550) : 550,
    minProtein: remainingProtein !== null && remainingProtein > 20 ? 18 : 10,
  });

  if (!recommendationRegex.test(normalized) && !lighterVersionRegex.test(normalized) && !sweetHealthyRegex.test(normalized) && !healthyTreatRegex.test(normalized)) {
    return null;
  }

  if (sweetHealthyRegex.test(normalized)) {
    return remainingCalories !== null && remainingCalories < 220
      ? 'Try something sweet but still light, like Greek yogurt with berries, a Yasso bar, or protein pudding.'
      : 'A good sweet-but-better option would be Greek yogurt with fruit, protein pudding, a Yasso bar, or dark chocolate with berries.';
  }

  if (healthyTreatRegex.test(normalized)) {
    return remainingCalories !== null && remainingCalories < 220
      ? 'A good healthy treat would be Greek yogurt with berries, a Yasso bar, protein pudding, or a Fairlife shake if you want something easy.'
      : 'A few solid healthy treats would be Greek yogurt with fruit, protein pudding, a Yasso bar, cottage cheese with fruit, or a Fairlife shake.';
  }

  if (lighterVersionRegex.test(normalized) && input.state.currentMealItems.length) {
    const mealLabel = input.state.currentMealItems.at(-1)?.food_name ?? 'that meal';
    return `For a lighter version of ${mealLabel}, I’d lean grilled instead of fried, skip heavy extras like cheese or mayo, and keep the side simpler.`;
  }

  if (/restaurant/.test(normalized) && suggestion) {
    return `Restaurant-wise, ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)} would fit pretty well.`;
  }

  if (/protein/.test(normalized)) {
    return remainingProtein !== null && remainingProtein > 25
      ? 'Go easy and protein-forward, like a Fairlife shake, Greek yogurt, cottage cheese, turkey jerky, or grilled chicken.'
      : 'Protein-wise, a shake, Greek yogurt, cottage cheese, jerky, or grilled chicken would all work.';
  }

  if (suggestion) {
    return `A solid option would be ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)}.`;
  }

  if (/lighter|light|low calorie/.test(normalized)) {
    return 'Something lighter could be grilled chicken, a yogurt bowl, eggs and fruit, or a simple wrap with lean protein.';
  }

  return 'A few good options would be a shake, Greek yogurt with fruit, eggs and toast, or a grilled chicken bowl depending on what sounds good.';
}

function buildComparisonReply(input: MealAssistantRunInput) {
  const normalized = input.message.trim().toLowerCase();

  if (!comparisonRegex.test(normalized)) {
    return null;
  }

  if (/grilled/.test(normalized) && /fried/.test(normalized)) {
    return 'Usually grilled is the lighter move because it tends to cut calories and fat while keeping protein similar.';
  }

  if (/rice/.test(normalized) && /fries|fry/.test(normalized)) {
    return 'Rice is usually the steadier option, while fries are heavier on calories and fat.';
  }

  return 'Usually the better call is the option with more protein and less fried or heavy add-ons.';
}

function updateConversationState(
  nextState: MealAssistantState,
  args: { intent: MealAssistantModelOutput['intent']; message: string; activeQuestion?: string | null },
) {
  let activeTopic: MealAssistantState['activeTopic'] = nextState.activeTopic ?? null;
  let activeMode: MealAssistantState['activeMode'] = nextState.activeMode ?? null;

  if (args.intent === 'new_food_item' || args.intent === 'add_to_current_meal' || args.intent === 'repeat_meal') {
    activeTopic = 'meal';
    activeMode = nextState.currentMealItems.length > 1 ? 'meal_building' : 'logging_mode';
  } else if (args.intent === 'correction' || args.intent === 'quantity_change' || args.intent === 'remove_item' || args.intent === 'edit_command' || args.intent === 'delete_command') {
    activeTopic = 'meal';
    activeMode = 'correction_mode';
  } else if (args.intent === 'nutrition_guidance' || args.intent === 'nutrition_question' || args.intent === 'macro_question' || args.intent === 'goal_question' || args.intent === 'comparison_question') {
    activeTopic = 'nutrition';
    activeMode = args.intent === 'macro_question' ? 'macro_discussion' : 'nutrition_coaching';
  } else if (args.intent === 'recommendation_request') {
    activeTopic = 'recommendation';
    activeMode = 'recommendation_mode';
  } else if (args.intent === 'save_meal' || args.intent === 'meal_review' || args.intent === 'meal_feedback') {
    activeTopic = 'review';
    activeMode = 'review_save';
  } else if (args.intent === 'casual_message' || args.intent === 'greeting') {
    activeTopic = offTopicRegex.test(args.message) ? 'off_topic' : 'casual';
    activeMode = 'casual_conversation';
  } else if (nextState.pendingClarification) {
    activeTopic = 'clarification';
    activeMode = 'logging_mode';
  }

  return {
    ...nextState,
    activeTopic,
    activeMode,
    activeQuestion: args.activeQuestion ?? nextState.activeQuestion ?? null,
    previousIntent: args.intent,
    previousUserMessage: args.message,
  };
}

function validateAssistantReply(args: {
  message: string;
  assistantReply: string;
  intent: MealAssistantModelOutput['intent'];
  state: MealAssistantState;
  context: MealAssistantContext;
}) {
  const macroReply = buildCurrentMealMacroReply(args.message, args.state);
  const nutritionReply = buildNutritionGuidanceReply({ message: args.message, state: args.state, context: args.context }, args.context);
  const recommendationReply = buildRecommendationReply({ message: args.message, state: args.state, context: args.context }, args.context);
  const comparisonReply = buildComparisonReply({ message: args.message, state: args.state, context: args.context });

  if ((args.intent === 'macro_question' || followUpMacroRegex.test(args.message)) && macroReply) {
    return macroReply;
  }

  if ((args.intent === 'macro_question' || args.intent === 'nutrition_guidance' || args.intent === 'nutrition_question' || followUpMacroRegex.test(args.message)) && nutritionReply) {
    return nutritionReply;
  }

  if ((args.intent === 'recommendation_request' || recommendationRegex.test(args.message)) && recommendationReply) {
    return recommendationReply;
  }

  if ((args.intent === 'comparison_question' || comparisonRegex.test(args.message)) && comparisonReply) {
    return comparisonReply;
  }

  if ((args.intent === 'casual_message' || args.intent === 'greeting') && isGenericReply(args.assistantReply)) {
    return buildFallbackReply(args.message, args.state, args.context);
  }

  return args.assistantReply;
}

function postProcessAssistantReply(reply: string, state: MealAssistantState, message?: string) {
  let nextReply = sanitizeAssistantText(reply)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,])/g, '$1');

  if (!nextReply || isWeakStandaloneReply(nextReply)) {
    if (message && /\bpizza\b/i.test(message) && !state.currentMealItems.length) {
      nextReply = buildPizzaPortionQuestion(message);
    } else if (state.currentMealItems.length) {
      nextReply = buildFoodAwareFallbackReply(message ?? state.currentMealText ?? 'this meal', state.currentMealItems);
    } else {
      nextReply = message ? `Tell me the amount for ${cleanOriginalFoodName(message)}.` : 'Tell me what you ate.';
    }
  }

  nextReply = polishRepeatedOpening(nextReply, state);

  if (!/[.!?]$/.test(nextReply)) {
    nextReply = `${nextReply}.`;
  }

  if (nextReply.length > 260) {
    nextReply = `${nextReply.slice(0, 257).trimEnd()}…`;
  }

  if (state.lastAssistantReply && normalizeText(state.lastAssistantReply) === normalizeText(nextReply)) {
    if (/^saved\b/i.test(nextReply)) {
      nextReply = 'Saved. Ready for the next one?';
    } else {
      nextReply = buildContextualContinuityReply(state);
    }
  }

  return sanitizeAssistantText(nextReply);
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

function tokenizeMealIdentity(items: ParsedFoodItem[]) {
  return Array.from(
    new Set(
      items
        .flatMap((item) => normalizeText(item.food_name).split(' '))
        .filter((token) => token && token.length > 2 && !['with', 'and', 'the', 'meal', 'food'].includes(token)),
    ),
  );
}

function scoreMealSimilarity(items: ParsedFoodItem[], entry: MealAssistantMemoryMeal) {
  const targetTokens = tokenizeMealIdentity(items);
  const candidateTokens = tokenizeMealIdentity(entry.items);

  if (!targetTokens.length || !candidateTokens.length) {
    return 0;
  }

  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
  if (!overlap) {
    return 0;
  }

  return overlap / Math.max(targetTokens.length, candidateTokens.length);
}

function findSimilarMealPattern(items: ParsedFoodItem[], entries: MealAssistantMemoryMeal[]) {
  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreMealSimilarity(items, entry),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return best && best.score >= 0.5 ? best : null;
}

function buildWeeklySummaryReply(context: MealAssistantContext) {
  const recentWeek = (context.recentMeals ?? []).filter((meal) => {
    const occurredAt = parseIsoTime(getRecentMealOccurredAt(meal));
    return occurredAt !== null && Date.now() - occurredAt <= 7 * 86400000;
  });

  if (!recentWeek.length) {
    return 'This week is still pretty open. Give me a couple meals and I can start calling out the pattern without turning it into a dashboard.';
  }

  const proteinForwardCount = recentWeek.filter((meal) => sumTotals(meal.items).protein >= 25).length;
  const repeatedMealCounts = recentWeek.reduce<Record<string, { title: string; count: number }>>((acc, meal) => {
    const key = normalizeText(meal.rawText ?? meal.title);
    acc[key] = {
      title: meal.rawText ?? meal.title,
      count: (acc[key]?.count ?? 0) + 1,
    };
    return acc;
  }, {});

  const repeatedMeal = Object.values(repeatedMealCounts).sort((left, right) => right.count - left.count)[0] ?? null;
  const mealTypeCounts = recentWeek.reduce<Record<string, number>>((acc, meal) => {
    acc[meal.mealType] = (acc[meal.mealType] ?? 0) + 1;
    return acc;
  }, {});
  const topMealType = Object.entries(mealTypeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  const intro = recentWeek.length >= 5
    ? `This week looks pretty steady so far with ${recentWeek.length} logged meals.`
    : `This week is starting to take shape with ${recentWeek.length} logged meals.`;

  if (repeatedMeal && repeatedMeal.count >= 2) {
    return `${intro} ${repeatedMeal.title} keeps showing up as one of your go-tos.`;
  }

  if (proteinForwardCount >= Math.ceil(recentWeek.length / 2)) {
    return `${intro} You’ve been leaning pretty protein-forward more often than not.`;
  }

  if (topMealType) {
    return `${intro} ${topMealType.charAt(0).toUpperCase()}${topMealType.slice(1)} has been your most consistent check-in.`;
  }

  return intro;
}

function buildConversationRecoveryReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const hasActiveMeal = input.state.currentMealItems.length > 0;
  const hasDailyContext = [context.todayProtein, context.todayCalories, context.remainingProtein, context.remainingCalories, context.remainingCarbs, context.remainingFat].some(
    (value) => value !== null && value !== undefined,
  );

  if (input.state.pendingClarification && /^(?:wait|which one|what do you need|what do you mean|what does that mean|wym)\b/i.test(normalized)) {
    return `I just need one detail to keep going: ${input.state.pendingClarification}`;
  }

  if (ambiguousFollowUpRegex.test(normalized) || (/\?$/.test(normalized) && /\b(?:it|that|this|those|them)\b/.test(normalized))) {
    if (!hasActiveMeal && (input.state.previousIntent || input.state.activeTopic)) {
      if (input.state.activeTopic === 'nutrition' || input.state.previousIntent === 'nutrition_guidance' || input.state.previousIntent === 'macro_question') {
        return 'We were talking about your day overall. If you mean the meal instead, send the meal or ask about this meal once it’s in front of me.';
      }

      return 'We were between the meal thread and the day-level view. If you mean the meal, send it again or ask about this meal. If you mean today, ask what you have left.';
    }

    if (!hasActiveMeal) {
      return null;
    }

    if (hasDailyContext) {
      return 'I think I lost track of whether we were editing the meal or talking about today overall. If you mean the meal, ask about this meal. If you mean today, ask what you have left.';
    }

    return 'I think I lost track of whether we were still editing the meal or starting a new question. Tell me the meal change or the macro question and I’ll stay on it.';
  }

  return null;
}

function buildCompanionInsight(args: { response: MealAssistantResponse; input: MealAssistantRunInput; context: MealAssistantContext }) {
  const { response, input, context } = args;
  const normalized = input.message.trim().toLowerCase();
  const remainingProtein = getRemainingProtein(context);
  const remainingCalories = getRemainingCalories(context);

  if (response.should_ask_clarification || response.next_state.saved || weeklySummaryRegex.test(normalized)) {
    return null;
  }

  if (response.intent === 'nutrition_guidance' && proteinLeftRegex.test(normalized) && remainingProtein !== null && remainingProtein >= 40) {
    return 'You’re still pretty low on protein today';
  }

  if (!response.meal.items.length) {
    return null;
  }

  const yesterdayMatch = findSimilarMealPattern(
    response.meal.items,
    (context.recentMeals ?? []).filter((meal) => isYesterday(getRecentMealOccurredAt(meal))),
  );

  if (yesterdayMatch && response.intent !== 'repeat_meal' && !repeatCueRegex.test(normalized)) {
    return `That’s pretty close to yesterday’s ${yesterdayMatch.entry.mealType}`;
  }

  const usualMatch = findSimilarMealPattern(
    response.meal.items,
    getMemoryEntries(context).filter((entry) => entry.source !== 'recent'),
  );

  if (usualMatch && response.intent === 'new_food_item' && !repeatCueRegex.test(normalized)) {
    return `That’s close to one of your usual ${usualMatch.entry.mealType} picks`;
  }

  if (remainingProtein !== null && remainingProtein >= 40 && response.meal.totals.protein < 20) {
    return 'You’re still pretty low on protein today';
  }

  if (response.next_state.mealType === 'dinner' && remainingCalories !== null && remainingCalories >= 200 && response.meal.totals.calories <= 750) {
    return 'You’ve still got room for a snack tonight';
  }

  return null;
}

function finalizeResponse(response: MealAssistantResponse, input: MealAssistantRunInput, context: MealAssistantContext) {
  const insight = buildCompanionInsight({ response, input, context });

  if (!insight || normalizeText(response.assistant_reply).includes(normalizeText(insight))) {
    return response;
  }

  const combinedReply = postProcessAssistantReply(
    `${response.assistant_reply.replace(/[.!?]+$/, '')}. ${insight}`,
    response.next_state,
    input.message,
  );

  return {
    ...response,
    assistant_reply: combinedReply,
    next_state: {
      ...response.next_state,
      lastAssistantReply: combinedReply,
    },
  };
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

function findYesterdayMemoryEntry(context: MealAssistantContext, mealTypeHint?: string | null) {
  const recentEntries = (context.recentMeals ?? [])
    .filter((entry) => entry.items.length > 0 && isYesterday(getRecentMealOccurredAt(entry)))
    .filter((entry) => !mealTypeHint || entry.mealType === mealTypeHint)
    .sort((left, right) => (parseIsoTime(getRecentMealOccurredAt(right)) ?? 0) - (parseIsoTime(getRecentMealOccurredAt(left)) ?? 0));

  return recentEntries[0] ?? null;
}

function buildCasualReply(message: string, state: MealAssistantState) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (/how(?:'|’)??s your day|how are you/.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, [
          'Doing good, I’m still with this meal if you want to keep going.',
          'I’m good, and I still have this meal in front of me if you want to keep building it.',
          'Doing alright. I can keep working on this meal, or you can send the next food.',
        ])
      : choosePhrase(normalized, [
          'Doing good. What did you eat?',
          'I’m good, ready when you are. What’d you have?',
          'I’m here and ready. What did you eat?',
        ]);
  }

  if (jokeRequestRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, [
          'I’m better at calories than stand-up, but I’m still holding this meal if you want to keep going.',
          'Best joke I’ve got is that sauces count less than people think. I’ve still got this meal if you want to keep going.',
          'My jokes are mid, but the meal is still here. Want to keep going?',
        ])
      : choosePhrase(normalized, [
          'I’m better at logging than stand-up, so give me a meal and I’ll do my best work.',
          'My nutrition jokes are pretty average, but I can absolutely log your food. What’d you have?',
          'I’ll spare you the bad joke and help with the meal instead. What did you eat?',
        ]);
  }

  if (laughRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['😂 fair, what else went with it?', '😂 alright, what else did you eat?', '😂 got you, anything else in this meal?'])
      : choosePhrase(normalized, ['😂 alright, what did you have?', '😂 fair, what’d you eat?', '😂 okay, send the meal whenever you want.']);
  }

  if (appreciationRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['Anytime. Want to add anything else to this meal?', 'Of course. Want to keep building this one?', 'Yep, I’ve got you. Anything else for this meal?'])
      : choosePhrase(normalized, ['Anytime. Send the meal whenever you’re ready.', 'Of course. What did you have?', 'Yep, anytime. What are we logging?']);
  }

  if (frustrationRegex.test(normalized) && !/\b(?:no|actually|i meant|instead|make that|update that to|it was|that was)\b/i.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['No worries, I can fix it. Tell me what needs to change.', 'All good, we can clean it up. What should I change?', 'No stress, I’ve got the meal. Tell me what to fix.'])
      : choosePhrase(normalized, ['No worries, start with what you had and I’ll keep it simple.', 'All good. Just send the meal naturally and I’ll handle it.', 'No stress. Tell me what you ate and we’ll sort it out.']);
  }

  if (greetingRegex.test(normalized)) {
    return hasActiveMeal ? 'Hey, I’m with you. Want to keep going on this meal?' : choosePhrase(normalized, ['Hey, what did you eat?', 'Hey, what are we logging?', 'I’m here. What’d you have?']);
  }

  if (casualRegex.test(normalized)) {
    return hasActiveMeal
      ? buildContextualContinuityReply(state)
      : choosePhrase(normalized, ['All good. What did you eat?', 'Yep, send the meal whenever you’re ready.']);
  }

  if (offTopicRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['I’m still holding this meal if you want to keep going.', 'I can keep working on this meal, or you can send the next food.', 'I’ve still got this meal here if you want to keep building it.'])
      : choosePhrase(normalized, ['I’m here for the food side. What did you eat?', 'I can help most on the nutrition side. What’d you have?', 'I’m best at the food part. What are we logging?']);
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

  if ((sizeUpRegex.test(normalized) || sizeDownRegex.test(normalized)) && mealDescriptorReferenceRegex.test(normalized)) {
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
      message: input.message,
    });
  }

  if (healthyCueRegex.test(normalized) && mealDescriptorReferenceRegex.test(normalized)) {
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
      message: input.message,
    });
  }

  return null;
}

function subtractNutrition(item: ParsedFoodItem, values: Partial<Pick<ParsedFoodItem, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'>>) {
  return {
    ...item,
    calories: Number(Math.max(0, item.calories - (values.calories ?? 0)).toFixed(1)),
    protein: Number(Math.max(0, item.protein - (values.protein ?? 0)).toFixed(1)),
    carbs: Number(Math.max(0, item.carbs - (values.carbs ?? 0)).toFixed(1)),
    fat: Number(Math.max(0, item.fat - (values.fat ?? 0)).toFixed(1)),
    fiber: Number(Math.max(0, item.fiber - (values.fiber ?? 0)).toFixed(1)),
    sugar: Number(Math.max(0, item.sugar - (values.sugar ?? 0)).toFixed(1)),
    sodium: Number(Math.max(0, item.sodium - (values.sodium ?? 0)).toFixed(1)),
  };
}

function regularizeChipotleChicken(item: ParsedFoodItem) {
  const nextName = /\bdouble chicken\b/i.test(item.food_name)
    ? item.food_name.replace(/\bdouble chicken\b/gi, 'chicken')
    : item.food_name.replace(/\bextra chicken\b/gi, 'chicken');
  const adjusted = subtractNutrition(item, {
    calories: 180,
    protein: 32,
    fat: 7,
    sodium: 310,
  });

  return {
    ...adjusted,
    food_name: nextName === item.food_name ? item.food_name : nextName,
    notes: [item.notes, 'Adjusted from double chicken to regular chicken.'].filter(Boolean).join(' '),
    original_user_text: item.original_user_text ?? item.food_name,
  };
}

function buildChipotleChipsGuacItem(message: string) {
  return makeGenericEstimate(
    {
      key: 'chipotle chips with guacamole',
      label: 'Chipotle chips with guacamole',
      quantity: 1,
      unit: 'order',
      calories: 770,
      protein: 8,
      carbs: 81,
      fat: 47,
      fiber: 12,
      sugar: 3,
      sodium: 1130,
      sourceName: 'Chipotle chips and guacamole estimate',
    },
    message,
  );
}

async function buildAdaptiveMealMutationReply(
  input: MealAssistantRunInput,
  resolveItemNutrition: NutritionResolver,
): Promise<MealAssistantResponse | null> {
  if (!input.state.currentMealItems.length) {
    return null;
  }

  const normalized = stripEmotionalPreface(input.message).toLowerCase();
  const currentItems = cloneParsedItems(input.state.currentMealItems);
  const targetIndex = findContextualItemIndex(input.message, currentItems);
  const targetItem = targetIndex >= 0 ? currentItems[targetIndex] : currentItems.at(-1) ?? null;

  if (!targetItem) {
    return null;
  }

  const chipotleIndex = currentItems.findIndex((item) => /\bchipotle\b/i.test(item.food_name));
  const wantsRegularChicken = /\bregular chicken\b/.test(normalized) && /\b(?:double|extra)\b/.test(normalized);
  const wantsChipsGuac = /\bchips?\b/.test(normalized) && /\bguac(?:amole)?\b/.test(normalized);

  if (chipotleIndex >= 0 && (wantsRegularChicken || wantsChipsGuac) && correctionCueRegex.test(normalized)) {
    const nextItems = currentItems.map((item, index) => {
      if (index !== chipotleIndex || !wantsRegularChicken) {
        return item;
      }

      return regularizeChipotleChicken(item);
    });

    if (wantsChipsGuac && !nextItems.some((item) => /\bchips?\b/i.test(item.food_name) && /\bguac/i.test(item.food_name))) {
      nextItems.push(buildChipotleChipsGuacItem(input.message));
    }

    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
      userCorrections: [...input.state.userCorrections, input.message],
    };
    const totalCalories = Math.round(sumTotals(nextItems).calories);
    const changeSummary = [
      wantsRegularChicken ? 'switched it to regular chicken' : null,
      wantsChipsGuac ? 'added chips with guac' : null,
    ].filter(Boolean).join(' and ');

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: `Yep, ${changeSummary}. That brings this meal to about ${totalCalories} calories.`,
      nextState,
      message: input.message,
    });
  }

  const explicitQuantityMatch = normalized.match(explicitQuantityUpdateRegex);
  if (explicitQuantityMatch) {
    const nextQuantity = parseCount(explicitQuantityMatch[1] ?? '');
    if (nextQuantity > 0) {
      const nextItems = scaleMealAtIndex(currentItems, targetIndex >= 0 ? targetIndex : currentItems.length - 1, nextQuantity / Math.max(targetItem.quantity, 1));
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };

      return buildDirectResponse({
        intent: 'quantity_change',
        assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}:${nextQuantity}`, [
          `Done, I changed that to ${nextQuantity} ${targetItem.food_name}.`,
          `Okay, I updated that to ${nextQuantity} ${targetItem.food_name}.`,
          `Got you, that’s ${nextQuantity} ${targetItem.food_name} now.`,
        ]),
        nextState,
        message: input.message,
      });
    }
  }

  if (doubleThatRegex.test(normalized)) {
    const nextItems = scaleMealAtIndex(currentItems, targetIndex >= 0 ? targetIndex : currentItems.length - 1, 2);
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'quantity_change',
      assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}`, [
        `Done, I doubled ${targetItem.food_name}.`,
        `Got you, I doubled ${targetItem.food_name}.`,
        `${targetItem.food_name} is doubled now.`,
      ]),
      nextState,
      message: input.message,
    });
  }

  if (grilledSwapRegex.test(normalized)) {
    const replacementName = /fried/i.test(targetItem.food_name)
      ? targetItem.food_name.replace(/fried/gi, 'Grilled')
      : `Grilled ${targetItem.food_name}`.replace(/Grilled Grilled/gi, 'Grilled');

    const lookedUp = await resolveItemNutrition({
      item: {
        name: replacementName,
        brand: null,
        quantity: targetItem.quantity,
        unit: targetItem.unit ?? null,
        modifiers: [],
        action: 'replace',
      },
      mealType: input.state.mealType,
    });

    const replacement = lookedUp?.items?.[0]
      ? lookedUp.items[0]
      : {
          ...targetItem,
          food_name: replacementName,
          calories: Number((targetItem.calories * 0.82).toFixed(1)),
          fat: Number((targetItem.fat * 0.62).toFixed(1)),
          notes: 'Adjusted toward a grilled version.',
        };

    const nextItems = currentItems.map((item, index) => (index === (targetIndex >= 0 ? targetIndex : currentItems.length - 1) ? replacement : item));
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}`, [
        `Yep, I switched that to grilled.`,
        `Got it, I changed that to a grilled version.`,
        `Okay, I’m treating that as grilled now.`,
      ]),
      nextState,
      message: input.message,
    });
  }

  return null;
}

function buildDirectResponse(args: {
  intent: MealAssistantModelOutput['intent'];
  assistantReply: string;
  nextState: MealAssistantState;
  message?: string;
  activeQuestion?: string | null;
}) {
  const mealItems = args.nextState.currentMealItems;
  const totals = sumTotals(mealItems);
  const assistantReply = postProcessAssistantReply(args.assistantReply, args.nextState, args.message);
  const nextState = args.message
    ? updateConversationState(args.nextState, {
        intent: args.intent,
        message: args.message,
        activeQuestion: args.activeQuestion,
      })
    : args.nextState;

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
      confidence_score: nextState.confidenceScore,
    },
    next_state: {
      ...nextState,
      lastAssistantReply: assistantReply,
    },
  } satisfies MealAssistantResponse;
}

function buildDirectFoodEstimateResponse(args: {
  input: MealAssistantRunInput;
  state: MealAssistantState;
  items: ParsedFoodItem[];
  intent?: MealAssistantModelOutput['intent'];
  followUpMessage?: string | null;
  context?: MealAssistantContext;
}) {
  const normalized = stripEmotionalPreface(args.input.message).toLowerCase();
  const intent = args.intent ?? (args.state.currentMealItems.length && continuationRegex.test(normalized) ? 'add_to_current_meal' : 'new_food_item');
  const currentMealItems = intent === 'add_to_current_meal'
    ? [...args.state.currentMealItems, ...args.items]
    : args.items;
  const nextState: MealAssistantState = {
    ...args.state,
    currentMealItems,
    userCorrections: intent === 'clarification_answer' ? [...args.state.userCorrections, args.input.message] : [...args.state.userCorrections],
    currentMealText: buildMealTextFromItems(currentMealItems),
    confidenceScore: getConfidenceScore(currentMealItems),
    pendingClarification: null,
    lastAssistantQuestion: null,
    saved: false,
    sourceReusableMealId: intent === 'new_food_item' ? null : args.state.sourceReusableMealId,
    editingMealId: intent === 'new_food_item' ? null : args.state.editingMealId,
  };

  const primaryReply = buildReplyFromItems({
    intent,
    decisionReply: 'Got it.',
    resolvedItems: intent === 'add_to_current_meal' ? currentMealItems : args.items,
    message: args.input.message,
  });
  const followUpReply = args.followUpMessage && args.context ? buildInlineFollowUpReply(args.followUpMessage, nextState, args.context) : null;

  return buildDirectResponse({
    intent,
    assistantReply: [primaryReply, followUpReply].filter(Boolean).join(' '),
    nextState,
    message: args.input.message,
  });
}

async function buildDeterministicDialogueResponse(
  input: MealAssistantRunInput,
  context: MealAssistantContext,
  resolveItemNutrition: NutritionResolver,
  saveMeal: SaveExecutor,
) {
  const state = input.state;
  const normalized = stripEmotionalPreface(input.message).toLowerCase();

  if (saveRegex.test(normalized)) {
    if (state.currentMealItems.length) {
      await saveMeal({ state, items: state.currentMealItems });
    }

    return buildDirectResponse({
      intent: 'save_meal',
      assistantReply: state.currentMealItems.length ? 'Saved. Ready for the next one?' : 'There is not a meal to save yet. Send the meal whenever you are ready.',
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        saved: Boolean(state.currentMealItems.length),
        pendingClarification: null,
        lastAssistantQuestion: null,
      },
      message: input.message,
    });
  }

  const adaptiveMealMutationReply = await buildAdaptiveMealMutationReply(input, resolveItemNutrition);
  if (adaptiveMealMutationReply) {
    return adaptiveMealMutationReply;
  }

  const recommendationReply = buildRecommendationReply(input, context);
  if (recommendationReply) {
    return buildDirectResponse({
      intent: 'recommendation_request',
      assistantReply: recommendationReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const descriptorReply = buildMealDescriptorReply(input, context);
  if (descriptorReply) {
    return descriptorReply;
  }

  const macroReply = buildCurrentMealMacroReply(input.message, state);
  if (macroReply) {
    return buildDirectResponse({
      intent: 'macro_question',
      assistantReply: macroReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const comparisonReply = buildComparisonReply(input);
  if (comparisonReply) {
    return buildDirectResponse({
      intent: 'comparison_question',
      assistantReply: comparisonReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  if (weeklySummaryRegex.test(input.message.trim().toLowerCase())) {
    return buildDirectResponse({
      intent: 'nutrition_guidance',
      assistantReply: buildWeeklySummaryReply(context),
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const casualReply = buildCasualReply(input.message, state);
  if (casualReply) {
    return buildDirectResponse({
      intent: greetingRegex.test(input.message) && !state.currentMealItems.length ? 'greeting' : 'casual_message',
      assistantReply: casualReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
    });
  }

  if (repeatYesterdayRegex.test(input.message.trim().toLowerCase())) {
    const yesterdayMeal = findYesterdayMemoryEntry(context, extractMealTypeHint(input.message) ?? null);
    if (yesterdayMeal) {
      const loadedItems = cloneParsedItems(yesterdayMeal.items);
      return buildDirectResponse({
        intent: 'repeat_meal',
        assistantReply: choosePhrase(input.message, [
          `Using yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `I pulled in yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `Got you, I've got yesterday's ${buildMemoryReference(yesterdayMeal)} loaded.`,
        ]),
        nextState: {
          ...state,
          currentMealItems: loadedItems,
          pendingClarification: null,
          lastAssistantQuestion: null,
          saved: false,
          mealType: yesterdayMeal.mealType,
          currentMealText: cleanMealReferenceText(yesterdayMeal.rawText) || cleanMealReferenceText(yesterdayMeal.title) || buildMealTextFromItems(loadedItems),
          confidenceScore: yesterdayMeal.confidenceScore ?? getConfidenceScore(loadedItems),
          sourceReusableMealId: null,
          editingMealId: null,
        },
        message: input.message,
      });
    }
  }

  const memoryMatch = findMatchingMemoryMeal(input, context);
  if (memoryMatch) {
    const loadedItems = cloneParsedItems(memoryMatch.candidate.items);
    const nextItems = memoryMatch.appendToCurrentMeal ? [...state.currentMealItems, ...loadedItems] : loadedItems;

    return buildDirectResponse({
      intent: memoryMatch.appendToCurrentMeal ? 'add_to_current_meal' : 'repeat_meal',
      assistantReply: buildMemoryLoadReply(memoryMatch, input.message),
      nextState: {
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
      },
      message: input.message,
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
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const recoveryReply = buildConversationRecoveryReply(input, context);
  if (recoveryReply) {
    return buildDirectResponse({
      intent: 'casual_message',
      assistantReply: recoveryReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  return null;
}

function buildInlineFollowUpReply(message: string, state: MealAssistantState, context: MealAssistantContext) {
  const replies: string[] = [];
  const seen = new Set<string>();
  const segments = message
    .split(/\r?\n+|(?<=[?.!])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidates = segments.length ? segments : [message];

  for (const candidate of candidates) {
    const macroReply = buildNutritionGuidanceReply({ message: candidate, state, context }, context);
    const key = macroReply ? normalizeText(macroReply) : null;
    if (macroReply && key && !seen.has(key)) {
      replies.push(macroReply);
      seen.add(key);
    }
  }

  if (dinnerSuggestionRegex.test(message) && !replies.some((reply) => /tonight|dinner|protein-forward|burrito bowl|grilled chicken/i.test(reply))) {
    const dinnerReply = buildNutritionGuidanceReply({ message: 'tonight idea', state, context }, context);
    const key = dinnerReply ? normalizeText(dinnerReply) : null;
    if (dinnerReply && key && !seen.has(key)) {
      replies.push(dinnerReply);
    }
  }

  return replies.length ? replies.join(' ') : null;
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

function getRemainingCarbs(context: MealAssistantContext) {
  if (context.remainingCarbs !== null && context.remainingCarbs !== undefined) {
    return Math.max(0, Math.round(context.remainingCarbs));
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayCarbs !== null && context.todayCarbs !== undefined) {
    const carbGoal = Math.round((context.dailyCalorieGoal * 0.4) / 4);
    return Math.max(0, Math.round(carbGoal - context.todayCarbs));
  }

  return null;
}

function getRemainingFat(context: MealAssistantContext) {
  if (context.remainingFat !== null && context.remainingFat !== undefined) {
    return Math.max(0, Math.round(context.remainingFat));
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayFat !== null && context.todayFat !== undefined) {
    const fatGoal = Math.round((context.dailyCalorieGoal * 0.3) / 9);
    return Math.max(0, Math.round(fatGoal - context.todayFat));
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
  const remainingCarbs = getRemainingCarbs(context);
  const remainingFat = getRemainingFat(context);
  const remainingCalories = getRemainingCalories(context);

  if (weeklySummaryRegex.test(normalized)) {
    return buildWeeklySummaryReply(context);
  }

  if (currentMealProteinRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.protein)}g of protein.`;
  }

  if (currentMealCaloriesRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.calories)} calories.`;
  }

  if (proteinLeftRegex.test(normalized)) {
    return remainingProtein !== null ? `You've got about ${remainingProtein}g of protein left today.` : 'I can estimate that once your daily goal is set.';
  }

  if (followUpMacroRegex.test(normalized) || /\bcarbs? left\b/i.test(normalized)) {
    if (carbsQuestionRegex.test(normalized) && remainingCarbs !== null) {
      return `You've got about ${remainingCarbs}g of carbs left today.`;
    }

    if (fatQuestionRegex.test(normalized) && remainingFat !== null) {
      return `You've got about ${remainingFat}g of fat left today.`;
    }

    if (proteinQuestionRegex.test(normalized) && remainingProtein !== null) {
      return `You've got about ${remainingProtein}g of protein left today.`;
    }

    if (caloriesQuestionRegex.test(normalized) && remainingCalories !== null) {
      return remainingCalories >= 0
        ? `You've got about ${remainingCalories} calories left today.`
        : `You're about ${Math.abs(remainingCalories)} calories over right now.`;
    }

    return 'I can answer that once your daily goals are set.';
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

  if (snackRoomRegex.test(normalized)) {
    if (remainingCalories === null && remainingProtein === null) {
      return 'Probably, but I can answer that more cleanly once your daily goals are set.';
    }

    if (remainingCalories !== null && remainingCalories <= 120) {
      return remainingProtein !== null && remainingProtein > 0
        ? `You still could, but keep it light. You’ve got about ${remainingCalories} calories and ${remainingProtein}g protein left.`
        : `You still could, but keep it pretty light. You’ve got about ${remainingCalories} calories left.`;
    }

    if (remainingCalories !== null && remainingCalories > 120) {
      return remainingProtein !== null && remainingProtein > 20
        ? `Yeah, you’ve got room. About ${remainingCalories} calories left, and you could still use roughly ${remainingProtein}g protein.`
        : `Yeah, you’ve got room for one. About ${remainingCalories} calories left today.`;
    }

    return remainingProtein !== null && remainingProtein > 20
      ? `Yeah, you’ve still got room, especially if you make it protein-forward. You’re about ${remainingProtein}g short on protein.`
      : 'Yeah, you should still have room for a snack.';
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

function buildFallbackReply(input: string, state: MealAssistantState, context?: MealAssistantContext) {
  const recoveryReply = context ? buildConversationRecoveryReply({ message: input, state, context }, context) : null;
  if (recoveryReply) {
    return recoveryReply;
  }

  if (context && weeklySummaryRegex.test(stripEmotionalPreface(input).toLowerCase())) {
    return buildWeeklySummaryReply(context);
  }

  const casualReply = buildCasualReply(input, state);
  if (casualReply) {
    return casualReply;
  }

  return state.currentMealItems.length
    ? buildContextualContinuityReply(state)
    : choosePhrase(input, ['Tell me what you ate.', 'What did you have?', 'Send the meal whenever you’re ready.']);
}

function extractFallbackItems(input: string, state: MealAssistantState): MealAssistantItem[] {
  const normalized = stripEmotionalPreface(input).toLowerCase();

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

  if (looksLikeRawConversationalFoodText(name, input)) {
    return [];
  }

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
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (greetingRegex.test(normalized) && !hasActiveMeal) {
    return {
      intent: 'greeting',
      assistant_reply: choosePhrase(normalized, ['Hey, what are we logging?', 'Hey, what did you eat?', 'I’m here. What did you have?']),
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (reviewRegex.test(normalized) && hasActiveMeal) {
    return {
      intent: 'meal_review',
      assistant_reply: 'Here’s what I have so far.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (editRegex.test(normalized) && hasActiveMeal) {
    return {
      intent: 'edit_command',
      assistant_reply: 'Sure, tell me what you want to change.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

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

  if (comparisonRegex.test(normalized)) {
    return {
      intent: 'comparison_question',
      assistant_reply: 'Let me compare that.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    };
  }

  if (followUpMacroRegex.test(normalized) || (hasActiveMeal && /\b(?:carbs?|fat|protein|calories?)\b/i.test(normalized) && /\?/.test(normalized))) {
    return {
      intent: 'macro_question',
      assistant_reply: 'Let me check that.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (recommendationRegex.test(normalized) || lighterVersionRegex.test(normalized) || sweetHealthyRegex.test(normalized) || healthyTreatRegex.test(normalized)) {
    return {
      intent: 'recommendation_request',
      assistant_reply: 'I’ve got a few ideas.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
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
  const transcriptMessages = (input.conversationHistory ?? [])
    .slice(-12)
    .filter((message) => message.text.trim())
    .map((message) => ({
      role: message.role,
      content: message.text.slice(0, 1200),
    }));

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: mealAssistantSystemPrompt,
      },
      ...transcriptMessages,
      {
        role: 'user',
        content: [
          'Use the conversation above like a normal chat thread. The JSON below is private app state for the latest turn.',
          'Return only the required JSON object for the latest user message.',
          JSON.stringify({
            latest_user_message: input.message,
            state: input.state,
            context: input.context ?? emptyContext,
            user_preferences: input.userPreferences ?? null,
          }),
        ].join('\n\n'),
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
  message = '',
) {
  const resolved: ParsedFoodItem[] = [];
  const safeItems = isNonFoodDialogueMessage(message)
    ? []
    : items.filter((item) => !isUnsafeLookupItem(item, message));

  for (const item of safeItems) {
    const response = await resolveItemNutrition({ item, mealType });
    if (response?.items.length) {
      resolved.push(...response.items.map((resolvedItem) => repairResolvedNutritionItem(item, resolvedItem)));
    }
  }

  return hardenResolvedItems({
    message,
    resolvedItems: resolved,
  });
}

function buildReplyFromItems(args: {
  intent: MealAssistantModelOutput['intent'];
  decisionReply: string;
  resolvedItems: ParsedFoodItem[];
  removedTargets?: string[];
  saved?: boolean;
  clarificationQuestion?: string | null;
  mealAlreadySaved?: boolean;
  message?: string;
}) {
  const { intent, decisionReply, resolvedItems, removedTargets = [], saved = false, clarificationQuestion = null, mealAlreadySaved = false, message = '' } = args;
  const normalizedMessage = message.trim().toLowerCase();

  if (clarificationQuestion) {
    return clarificationQuestion;
  }

  if (saved) {
    return choosePhrase(`${normalizedMessage}:${intent}:${mealAlreadySaved ? 'saved' : 'fresh'}`, [
      'Saved. Anything else?',
      'All set, that one is logged.',
      'Got it saved. Want to keep going?',
      'That one is in. Anything else?',
    ]);
  }

  if (intent === 'start_new_meal') {
    return choosePhrase(decisionReply, ['Okay, starting fresh. What did you eat?', 'Alright, new meal. What’d you have?', 'Fresh start. What did you eat?']);
  }

  if (
    intent === 'casual_message' ||
    intent === 'greeting' ||
    intent === 'unknown' ||
    intent === 'nutrition_guidance' ||
    intent === 'nutrition_question' ||
    intent === 'macro_question' ||
    intent === 'recommendation_request' ||
    intent === 'meal_feedback' ||
    intent === 'comparison_question' ||
    intent === 'goal_question' ||
    intent === 'meal_review' ||
    intent === 'edit_command' ||
    intent === 'delete_command'
  ) {
    return decisionReply;
  }

  if (intent === 'remove_item' && removedTargets.length) {
    return choosePhrase(removedTargets.join(','), [`Removed ${removedTargets.join(', ')}.`, `Okay, I took out ${removedTargets.join(', ')}.`, `${removedTargets.join(', ')} is out now.`]);
  }

  if (!resolvedItems.length) {
    if (/checking that again/i.test(decisionReply)) {
      return decisionReply;
    }

    return isGenericReply(decisionReply) || isWeakStandaloneReply(decisionReply)
      ? buildFoodAwareFallbackReply(message, [])
      : decisionReply;
  }

  const mainItem = resolvedItems[0];
  const mainItemLabel = formatParsedItemLabel(mainItem);
  const totalCalories = Math.round(sumTotals(resolvedItems).calories);
  const sourceLabel = getSourceLabel(mainItem);
  const seed = `${intent}:${mainItem.food_name}:${totalCalories}:${sourceLabel}`;
  const hasFallbackEstimate = resolvedItems.some((item) => /fallback/i.test(item.source_name ?? ''));

  if (intent === 'new_food_item' && resolvedItems.length > 1 && hasFallbackEstimate) {
    return buildFoodAwareFallbackReply(message, resolvedItems);
  }

  if (intent === 'quantity_change') {
    const quantityLead = frustrationRegex.test(normalizedMessage)
      ? choosePhrase(normalizedMessage, ['No worries, I fixed that', 'All good, I updated it', 'Yep, I cleaned that up'])
      : choosePhrase(seed, ['Updated that', 'Okay, I changed it', 'Got you, I updated it']);

    return choosePhrase(seed, [
      `${quantityLead} to ${mainItemLabel}.`,
      `${quantityLead} I've got it as ${mainItemLabel} now.`,
      `${quantityLead} That's now ${mainItemLabel}.`,
    ]);
  }

  if (intent === 'correction') {
    const correctionLead = frustrationRegex.test(normalizedMessage)
      ? choosePhrase(normalizedMessage, ['No worries, I fixed that.', 'All good, I cleaned that up.', 'Yep, I corrected it.'])
      : choosePhrase(normalizedMessage || seed, ['Got you.', 'Okay, updating it.', 'That makes sense.']);

    return choosePhrase(seed, [
      `${correctionLead} I've got it as ${mainItemLabel}, about ${totalCalories} calories total. ${sourceLabel}.`,
      `${correctionLead} That's now ${mainItemLabel}, roughly ${totalCalories} calories. ${sourceLabel}.`,
      `${correctionLead} I switched it to ${mainItemLabel}. About ${totalCalories} calories total. ${sourceLabel}.`,
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
      `Nice, ${addedItem.food_name} is in there now. ${getSourceLabel(addedItem)}.`,
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
    `${mainItemLabel}, about ${totalCalories} calories total. ${sourceLabel}.`,
    `I've got ${mainItemLabel}, roughly ${totalCalories} calories. ${sourceLabel}.`,
    `That looks like ${mainItemLabel}, around ${totalCalories} calories total. ${sourceLabel}.`,
    `Alright, I've got ${mainItemLabel}. That comes out to about ${totalCalories} calories. ${sourceLabel}.`,
  ]);
}

function guardAssistantDecision(decision: MealAssistantModelOutput, input: MealAssistantRunInput): MealAssistantModelOutput {
  const safeItems = decision.items.filter((item) => !isUnsafeLookupItem(item, input.message));
  const droppedItems = safeItems.length !== decision.items.length;

  if (isNonFoodDialogueMessage(input.message)) {
    return {
      ...decision,
      intent: recommendationRegex.test(input.message) ? 'recommendation_request' : decision.intent,
      items: [],
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (!droppedItems) {
    return decision;
  }

  if (!safeItems.length && correctionCueRegex.test(input.message) && input.state.currentMealItems.length) {
    return {
      ...decision,
      intent: 'edit_command',
      assistant_reply: buildContextualContinuityReply(input.state),
      items: [],
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  return {
    ...decision,
    items: safeItems,
    should_lookup_nutrition: safeItems.length > 0 && decision.should_lookup_nutrition,
    should_ask_clarification: safeItems.length ? decision.should_ask_clarification : false,
    clarification_question: safeItems.length ? decision.clarification_question : null,
  };
}

export async function runMealAssistant(
  input: MealAssistantRunInput,
  dependencies: MealAssistantDependencies = {},
): Promise<MealAssistantResponse> {
  const classify = dependencies.classify ?? classifyWithModel;
  const resolveItemNutrition = dependencies.resolveItemNutrition ?? defaultResolveItemNutrition;
  const saveMeal = dependencies.saveMeal ?? defaultSaveMeal;
  const context = input.context ?? emptyContext;
  const mixedIntent = splitMixedIntentMessage(input.message);
  const workingInput: MealAssistantRunInput = mixedIntent.foodMessage
    ? {
        ...input,
        message: mixedIntent.foodMessage,
      }
    : input;
  const state = { ...workingInput.state };

  const pizzaClarificationItems = resolvePizzaClarificationEstimate(workingInput.message, state);
  if (pizzaClarificationItems.length) {
    return finalizeResponse(buildDirectFoodEstimateResponse({
      input: workingInput,
      state,
      items: pizzaClarificationItems,
      intent: 'clarification_answer',
      followUpMessage: mixedIntent.followUpMessage,
      context,
    }), workingInput, context);
  }

  const deterministicDialogueResponse = await buildDeterministicDialogueResponse(workingInput, context, resolveItemNutrition, saveMeal);
  if (deterministicDialogueResponse) {
    return finalizeResponse(deterministicDialogueResponse, workingInput, context);
  }

  const canUseDirectKnownFood =
    !dependencies.classify
    && !process.env.OPENAI_API_KEY
    && !state.pendingClarification
    && (!state.currentMealItems.length || state.saved || continuationRegex.test(stripEmotionalPreface(workingInput.message).toLowerCase()));
  const directKnownItems = canUseDirectKnownFood ? detectKnownFoodEstimates(workingInput.message) : [];
  if (directKnownItems.length) {
    const hydratedItems = await hydrateKnownEstimatesWithProviders(directKnownItems, state.mealType);
    return finalizeResponse(buildDirectFoodEstimateResponse({
      input: workingInput,
      state,
      items: hydratedItems,
      followUpMessage: mixedIntent.followUpMessage,
      context,
    }), workingInput, context);
  }

  if (!dependencies.classify) {
    const adaptiveMealMutationReply = await buildAdaptiveMealMutationReply(workingInput, resolveItemNutrition);
    if (adaptiveMealMutationReply) {
      return finalizeResponse(adaptiveMealMutationReply, workingInput, context);
    }

    const recommendationReply = buildRecommendationReply(workingInput, context);
    if (recommendationReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'recommendation_request',
        assistantReply: recommendationReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const descriptorReply = buildMealDescriptorReply(workingInput, context);
    if (descriptorReply) {
      return finalizeResponse(descriptorReply, workingInput, context);
    }

    const macroReply = buildCurrentMealMacroReply(workingInput.message, state);
    if (macroReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'macro_question',
        assistantReply: macroReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const comparisonReply = buildComparisonReply(workingInput);
    if (comparisonReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'comparison_question',
        assistantReply: comparisonReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    if (weeklySummaryRegex.test(workingInput.message.trim().toLowerCase())) {
      return finalizeResponse(buildDirectResponse({
        intent: 'nutrition_guidance',
        assistantReply: buildWeeklySummaryReply(context),
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const casualReply = buildCasualReply(workingInput.message, state);
    if (casualReply) {
      return finalizeResponse(buildDirectResponse({
        intent: greetingRegex.test(workingInput.message) && !state.currentMealItems.length ? 'greeting' : 'casual_message',
        assistantReply: casualReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
      }), workingInput, context);
    }

    if (repeatYesterdayRegex.test(workingInput.message.trim().toLowerCase())) {
      const yesterdayMeal = findYesterdayMemoryEntry(context, extractMealTypeHint(workingInput.message) ?? null);
      if (yesterdayMeal) {
        const loadedItems = cloneParsedItems(yesterdayMeal.items);
        const nextState: MealAssistantState = {
          ...state,
          currentMealItems: loadedItems,
          pendingClarification: null,
          lastAssistantQuestion: null,
          saved: false,
          mealType: yesterdayMeal.mealType,
          currentMealText: cleanMealReferenceText(yesterdayMeal.rawText) || cleanMealReferenceText(yesterdayMeal.title) || buildMealTextFromItems(loadedItems),
          confidenceScore: yesterdayMeal.confidenceScore ?? getConfidenceScore(loadedItems),
          sourceReusableMealId: null,
          editingMealId: null,
        };

        return finalizeResponse(buildDirectResponse({
          intent: 'repeat_meal',
          assistantReply: choosePhrase(workingInput.message, [
            `Using yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
            `I pulled in yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
            `Got you, I've got yesterday's ${buildMemoryReference(yesterdayMeal)} loaded.`,
          ]),
          nextState,
          message: workingInput.message,
        }), workingInput, context);
      }
    }

    const memoryMatch = findMatchingMemoryMeal(workingInput, context);
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

      return finalizeResponse(buildDirectResponse({
        intent: memoryMatch.appendToCurrentMeal ? 'add_to_current_meal' : 'repeat_meal',
        assistantReply: buildMemoryLoadReply(memoryMatch, workingInput.message),
        nextState,
        message: workingInput.message,
      }), workingInput, context);
    }

    const nutritionReply = buildNutritionGuidanceReply(workingInput, context);
    if (nutritionReply) {
      return finalizeResponse(buildDirectResponse({
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
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const recoveryReply = buildConversationRecoveryReply(workingInput, context);
    if (recoveryReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'casual_message',
        assistantReply: recoveryReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }
  }

  let decision = await classify({
    ...workingInput,
    context,
  });
  decision = guardAssistantDecision(decision, workingInput);

  const classifiedKnownItems = detectKnownFoodEstimates(workingInput.message);
  if (
    classifiedKnownItems.length
    && (decision.intent === 'new_food_item' || decision.intent === 'add_to_current_meal')
    && (decision.should_ask_clarification || !decision.items.length || !decision.should_lookup_nutrition)
  ) {
    const hydratedItems = await hydrateKnownEstimatesWithProviders(classifiedKnownItems, state.mealType);
    return finalizeResponse(buildDirectFoodEstimateResponse({
      input: workingInput,
      state,
      items: hydratedItems,
      intent: state.currentMealItems.length && !state.saved ? 'add_to_current_meal' : 'new_food_item',
      followUpMessage: mixedIntent.followUpMessage,
      context,
    }), workingInput, context);
  }

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

  if ((decision.intent === 'new_food_item' || decision.intent === 'add_to_current_meal') && shouldAskPizzaPortion(workingInput.message, decision.items)) {
    decision.should_ask_clarification = true;
    decision.clarification_question = buildPizzaPortionQuestion(workingInput.message);
    decision.should_lookup_nutrition = false;
    decision.items = [];
    clarificationQuestion = decision.clarification_question;
    nextState.pendingClarification = decision.clarification_question;
    nextState.lastAssistantQuestion = decision.clarification_question;
    nextState.saved = false;
  }

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
        ? await resolveAssistantItems(decision.items, nextState.mealType, resolveItemNutrition, workingInput.message)
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
  const primaryReply = validateAssistantReply({
    message: workingInput.message,
    assistantReply: buildReplyFromItems({
      intent: decision.intent,
      decisionReply: suppressedClarification
        ? 'Got it, I’m checking that again.'
        : decision.assistant_reply || buildFallbackReply(workingInput.message, state, context),
      resolvedItems: resolvedItems.length ? resolvedItems : mealItems,
      removedTargets,
      saved,
      clarificationQuestion,
      mealAlreadySaved: state.saved,
      message: workingInput.message,
    }),
    intent: decision.intent,
    state: {
      ...nextState,
      currentMealItems: mealItems,
    },
    context,
  });

  const followUpReply = mixedIntent.followUpMessage
    ? validateAssistantReply({
        message: mixedIntent.followUpMessage,
        assistantReply:
          buildCurrentMealMacroReply(mixedIntent.followUpMessage, {
            ...nextState,
            currentMealItems: mealItems,
          }) ||
          buildNutritionGuidanceReply(
            {
              ...workingInput,
              message: mixedIntent.followUpMessage,
              state: {
                ...nextState,
                currentMealItems: mealItems,
              },
            },
            context,
          ) ||
          buildRecommendationReply(
            {
              ...workingInput,
              message: mixedIntent.followUpMessage,
              state: {
                ...nextState,
                currentMealItems: mealItems,
              },
            },
            context,
          ) ||
          buildComparisonReply({
            ...workingInput,
            message: mixedIntent.followUpMessage,
            state: {
              ...nextState,
              currentMealItems: mealItems,
            },
          }) ||
          '',
        intent: /recommend|idea|suggest|something/.test(mixedIntent.followUpMessage.toLowerCase())
          ? 'recommendation_request'
          : followUpMacroRegex.test(mixedIntent.followUpMessage.toLowerCase()) || /\b(?:carbs?|fat|protein|calories?)\b/i.test(mixedIntent.followUpMessage)
            ? 'macro_question'
            : comparisonRegex.test(mixedIntent.followUpMessage.toLowerCase())
              ? 'comparison_question'
              : 'nutrition_guidance',
        state: {
          ...nextState,
          currentMealItems: mealItems,
        },
        context,
      })
    : null;

  const assistantReply = postProcessAssistantReply(
    [primaryReply, followUpReply].filter(Boolean).join(' '),
    {
      ...nextState,
      currentMealItems: mealItems,
    },
    workingInput.message,
  );

  nextState = updateConversationState(nextState, {
    intent: decision.intent,
    message: input.message,
    activeQuestion: clarificationQuestion ?? mixedIntent.followUpMessage ?? null,
  });

  return finalizeResponse({
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
  }, workingInput, context);
}

export type { MealAssistantDependencies, MealAssistantRunInput };
