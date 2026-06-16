import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';

export type LogMealAction =
  | 'new_meal'
  | 'add_item'
  | 'replace_meal'
  | 'modify_item'
  | 'remove_item'
  | 'ask_macros'
  | 'ask_calories'
  | 'save_confirm'
  | 'cancel'
  | 'clarification_response'
  | 'unknown';

export type LogMealIntentItem = {
  name: string;
  quantity: number;
  unit: string | null;
  modifiers: string[];
};

export type LogMealIntent = {
  action: LogMealAction;
  foodText: string | null;
  restaurant: string | null;
  brand: string | null;
  productTokens: string[];
  quantity: number;
  unit: string | null;
  modifiers: string[];
  mealType: MealAssistantState['mealType'] | null;
  items: LogMealIntentItem[];
  explicitAdd: boolean;
  explicitReplace: boolean;
  explicitSave: boolean;
};

const restaurantPatterns = [
  { pattern: /\bmcdonalds?\b|\bmc\s*donalds?\b/i, name: "McDonald's" },
  { pattern: /\bwendys\b/i, name: "Wendy's" },
  { pattern: /\bsubway\b/i, name: 'Subway' },
  { pattern: /\barbys?\b/i, name: "Arby's" },
  { pattern: /\bchipotle\b/i, name: 'Chipotle' },
  { pattern: /\bchick[-\s]*fil[-\s]*a\b/i, name: 'Chick-fil-A' },
];

const ignoredProductTokens = new Set([
  'a', 'an', 'and', 'at', 'for', 'from', 'had', 'i', 'include', 'it', 'my',
  'of', 'please', 'the', 'with',
  'no', 'without', 'hold', 'extra', 'grilled', 'buttered',
  'footlong', 'inch', 'inches',
  'mcdonalds', 'wendys', 'subway', 'arbys', 'chipotle', 'chickfila',
]);

const explicitAddPattern = /^(?:please\s+)?(?:wait\s+no\s+i\s+had|(?:wait\s+)?also\s+add|wait\s+add|add|also|plus|include|with)\b/i;
const explicitReplacePattern = /^(?:please\s+)?(?:replace(?:\s+(?:it|this|the meal))?(?:\s+with)?|swap(?:\s+(?:it|this))?(?:\s+for)?|instead(?:\s+of\s+that)?|change(?:\s+(?:it|this|the meal))?\s+to)\b/i;
const explicitSavePattern = /^(?:please\s+)?(?:save(?:\s+it|\s+this|\s+the meal)?|log\s+(?:it|this|the meal)|confirm)\b/i;
const affirmativePattern = /^(?:yes|yep|yeah|correct|looks?\s+good|that(?:'s| is)\s+right)$/i;
const correctionPattern = /^(?:actually\b|oh\s+i\s+meant\b|i\s+meant\b|make\s+that\b|nvm\b|nevermind\b|never\s+mind\b)|\bnot\b|\b(?:change|update|make)\s+the\b/i;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/\bbaconnator\b/g, 'baconator')
    .replace(/\bmc\s*double\b/g, 'mcdouble')
    .replace(/\bmcdoubles\b/g, 'mcdouble')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractModifiers(text: string) {
  const modifiers: string[] = [];
  if (/\b(?:no|without|hold(?:\s+the)?)\s+cheese\b/i.test(text)) modifiers.push('no cheese');
  if (/\bextra\s+cheese\b/i.test(text)) modifiers.push('extra cheese');
  if (/\bgrilled\b/i.test(text)) modifiers.push('grilled');
  if (/\bbuttered\b/i.test(text)) modifiers.push('buttered');
  if (/\bfoot\s*long\b|\bfootlong\b/i.test(text)) modifiers.push('footlong');
  return modifiers;
}

function stripConversationalLeadIn(text: string) {
  return text
    .replace(/^\s*(?:please\s+)?(?:i\s+(?:had|ate|got|ordered)|for\s+(?:breakfast|lunch|dinner|a snack)\s+i\s+(?:had|ate)|log)\s+/i, '')
    .trim();
}

function stripActionWords(text: string, action: LogMealAction) {
  if (action === 'add_item') {
    return text.replace(explicitAddPattern, '').trim();
  }

  if (action === 'replace_meal') {
    return text.replace(explicitReplacePattern, '').trim();
  }

  return stripConversationalLeadIn(text);
}

function extractQuantity(text: string) {
  const normalized = stripConversationalLeadIn(text);
  const numeric = normalized.match(/^\s*(\d+(?:\.\d+)?)\s+/);
  if (numeric) return Number(numeric[1]);
  const word = normalized.match(/^\s*(one|two|three|four|five|six)\s+/i)?.[1]?.toLowerCase();
  return word ? ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[word] ?? 1) : 1;
}

function extractUnit(text: string) {
  if (/\bfoot\s*long\b|\bfootlong\b/i.test(text)) return 'footlong';
  const inch = text.match(/\b(6|12)[-\s]?(?:inch|in)\b/i);
  if (inch) return `${inch[1]}-inch`;
  return null;
}

function cleanItemName(text: string) {
  return normalize(stripConversationalLeadIn(text))
    .replace(/^\d+(?:\.\d+)?\s+/, '')
    .replace(/^(?:one|two|three|four|five|six)\s+/, '')
    .replace(/\b(?:no|without|hold(?: the)?)\s+cheese\b/g, '')
    .replace(/\bextra\s+cheese\b/g, '')
    .replace(/\bfrom\s+(?:wendys|mcdonalds|subway|arbys|chipotle)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitFoodItems(foodText: string): LogMealIntentItem[] {
  const normalized = normalize(stripConversationalLeadIn(foodText));
  const protectedCompound = /\b(?:mac and cheese|fish and chips|peanut butter and jelly)\b/.test(normalized);
  const parts = protectedCompound
    ? [normalized]
    : normalized.split(/\s+(?:and|plus|with)\s+(?!no\b|without\b|extra\b)/);

  return parts
    .map((part) => ({
      name: cleanItemName(part),
      quantity: extractQuantity(part),
      unit: extractUnit(part),
      modifiers: extractModifiers(part),
    }))
    .filter((item) => item.name.length > 0);
}

function classifyAction(message: string, state: MealAssistantState): LogMealAction {
  const normalized = normalize(message);
  const hasPendingMeal = state.currentMealItems.length > 0 && !state.saved;
  const asksForAmount = /\b(?:macros?|how much|how many|what(?:s| is| are)|where(?:s| are)|total)\b/.test(normalized);
  const isRecommendationRequest = /\b(?:what should i eat|recommend|suggest|meal idea|snack idea)\b/.test(normalized);
  const isRecommendationFollowUp = state.previousIntent === 'recommendation_request'
    && /^(?:something|another|what about|how about|more)\b/.test(normalized);

  if (/^(?:cancel|discard|clear|start over)\b/.test(normalized)) return 'cancel';
  if (explicitSavePattern.test(normalized)) return hasPendingMeal ? 'save_confirm' : 'unknown';
  if (affirmativePattern.test(normalized)) return hasPendingMeal ? 'save_confirm' : 'unknown';
  if (isRecommendationRequest || isRecommendationFollowUp) return 'unknown';
  if (asksForAmount && /\bcalories?\b/.test(normalized) && !/\b(?:add|replace|ate|had)\b/.test(normalized)) return 'ask_calories';
  if (asksForAmount && /\b(?:macros?|protein|carbs?|fat)\b/.test(normalized) && !/\b(?:add|replace|ate|had)\b/.test(normalized)) return 'ask_macros';
  if (/^(?:remove|delete|drop|take\s+off)\b/.test(normalized) && hasPendingMeal) return 'remove_item';
  if (explicitAddPattern.test(normalized)) return 'add_item';
  if (explicitReplacePattern.test(normalized)) return 'replace_meal';
  if (hasPendingMeal && correctionPattern.test(normalized)) return 'modify_item';
  if (state.pendingClarification) return 'clarification_response';
  if (/\b[a-z]/.test(normalized) && !/^(?:no|okay|ok|thanks?)$/.test(normalized)) return 'new_meal';
  return 'unknown';
}

export function parseLogMealIntent(message: string, state: MealAssistantState): LogMealIntent {
  const normalized = normalize(message);
  const action = classifyAction(message, state);
  const carriesFood = ['new_meal', 'add_item', 'replace_meal', 'clarification_response'].includes(action);
  const foodText = carriesFood ? stripActionWords(message, action) : null;
  const restaurant = restaurantPatterns.find((entry) => entry.pattern.test(normalized))?.name ?? null;
  const modifiers = extractModifiers(normalized);
  const quantity = foodText ? extractQuantity(foodText) : 1;
  const unit = extractUnit(normalized);
  const mealType = (['breakfast', 'lunch', 'dinner', 'snack'] as const).find((type) => new RegExp(`\\b${type}\\b`).test(normalized)) ?? null;
  const items = foodText ? splitFoodItems(foodText) : [];
  const productTokens = cleanItemName(foodText ?? '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !ignoredProductTokens.has(token) && !/^\d/.test(token));

  return {
    action,
    foodText,
    restaurant,
    brand: restaurant,
    productTokens,
    quantity,
    unit,
    modifiers,
    mealType,
    items,
    explicitAdd: action === 'add_item',
    explicitReplace: action === 'replace_meal',
    explicitSave: explicitSavePattern.test(normalized),
  };
}
