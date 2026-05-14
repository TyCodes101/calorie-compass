import { analyzeMealText } from '@/lib/ai/analyze';

export type LoggerIntent = 'greeting' | 'food_log' | 'correction' | 'question' | 'meal_history_question' | 'recommendation_request' | 'casual' | 'unknown';
export type LoggerCommand = 'save' | 'start_over' | 'favorite' | 'remove_favorite' | 'none';

const greetingRegex = /^(hi|hello|hey|yo|sup|what'?s up|good morning|good afternoon|good evening|how are you|how'?s it going)(?:\b|[!.?,]|$)/i;
const casualRegex = /^(ok|okay|kk|cool|nice|got it|sounds good|thanks|thank you|thx|lol|lmao|bet|hmm|huh|yep|yup)(?:\b|[!.?,]|$)/i;
const questionRegex = /\?|^(what|how|can|could|would|should|do|does|is|are|am|will|did)\b/i;
const mealHistoryRegex = /(what (did|have) i (eat|log)|what was (my )?(last|recent) meal|what did i have yesterday|what did i eat yesterday|what did i log yesterday|what did i eat today|what did i have today|last meal|recent meals?|yesterday'?s (dinner|lunch|breakfast|meals?))/i;
const recommendationRegex = /(what should i eat|what should i have|what do you recommend|any ideas? for|meal ideas?|recommend (something|a meal)|suggest (something|a meal)|give me (a|some) (meal )?ideas?|help me pick)/i;
const correctionRegex = /^(actually|sorry|correction|i meant|make that|make it|change that|change it to|change to|not exactly|update that|edit that|add\b|remove|without|no\b|it was|that was|swap|hold the|skip the)\b/i;
const saveCommandRegex = /^(save( it| that| this)?|log( it| that| this)?|looks good|that'?s right|done|good to save|save now)\b/i;
const startOverCommandRegex = /^(start over|reset|new meal|clear this|try again)\b/i;
const favoriteCommandRegex = /^(save favorite|favorite this|save as favorite)\b/i;
const removeFavoriteCommandRegex = /^(remove favorite|unfavorite this|delete favorite)\b/i;
const foodSignalRegex = /\b(chipotle|starbucks|mcdonald'?s?|chick-?fil-?a|burger|fries|pizza|taco|burrito|sandwich|salad|bowl|rice|chicken|beef|steak|salmon|shrimp|pasta|noodles|egg|eggs|toast|bagel|oatmeal|yogurt|banana|apple|shake|smoothie|protein|latte|coffee|coke|soda|fairlife|quest|premier|bar|cookie|ice cream|frappuccino|mcdouble|mcchicken)\b/i;

export function detectLoggerIntent(input: string, options?: { hasActiveMeal?: boolean }): LoggerIntent {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return 'unknown';
  }

  if (options?.hasActiveMeal && correctionRegex.test(normalized)) {
    return 'correction';
  }

  const analysis = analyzeMealText(input);
  const hasFoodSignals =
    Boolean(analysis.brand) ||
    analysis.category !== 'unknown' ||
    analysis.hasPortion ||
    analysis.hasExplicitCountableQuantity ||
    analysis.looksLikeSimpleCountableMeal ||
    foodSignalRegex.test(normalized);

  if (greetingRegex.test(normalized) && normalized.split(/\s+/).length <= 7 && !hasFoodSignals) {
    return 'greeting';
  }

  if (mealHistoryRegex.test(normalized)) {
    return 'meal_history_question';
  }

  if (recommendationRegex.test(normalized)) {
    return 'recommendation_request';
  }

  if (casualRegex.test(normalized) && !hasFoodSignals) {
    return 'casual';
  }

  if (questionRegex.test(normalized) && !analysis.brand && analysis.category === 'unknown' && !analysis.hasPortion && !analysis.hasExplicitCountableQuantity) {
    return 'question';
  }

  if (correctionRegex.test(normalized) && !hasFoodSignals) {
    return 'correction';
  }

  if (hasFoodSignals) {
    return 'food_log';
  }

  if (questionRegex.test(normalized)) {
    return 'question';
  }

  if (correctionRegex.test(normalized)) {
    return 'correction';
  }

  return 'unknown';
}

export function buildLoggerIntentReply(intent: LoggerIntent, options?: { userName?: string | null; hasActiveMeal?: boolean }) {
  const firstName = options?.userName?.trim()?.split(/\s+/)[0] ?? null;
  const namePrefix = firstName ? ` ${firstName}` : '';

  switch (intent) {
    case 'greeting':
      return options?.hasActiveMeal ? `Hey${namePrefix}, want to keep working on this meal or start a new one?` : `Hey${namePrefix}, what'd you eat?`;
    case 'correction':
      return options?.hasActiveMeal
        ? "Got you. Tell me what changed and I'll update it."
        : "No problem. Send the corrected meal and I'll update the estimate.";
    case 'question':
      return options?.hasActiveMeal
        ? "I can help with that. If it's about this meal, ask it naturally and I'll keep the current estimate in place."
        : "I can help with that. Ask the question naturally, or send the meal and I'll log it.";
    case 'meal_history_question':
      return options?.hasActiveMeal
        ? "I can check that. I’ll keep this meal in place while we look at your recent logging."
        : 'I can check that. I’ll look at your recent meals and keep it simple.';
    case 'recommendation_request':
      return options?.hasActiveMeal
        ? 'I can help with that. If you want, I can suggest something based on your current meal and your usual picks.'
        : 'I can help with that. I can suggest something based on your goals and the meals you repeat most.';
    case 'casual':
      return options?.hasActiveMeal ? 'Got it. I can keep adjusting this one whenever you want.' : 'All good. Send the meal whenever you’re ready.';
    case 'unknown':
    default:
      return options?.hasActiveMeal
        ? "I'm with you. You can update this meal, save it, or start a new one."
        : "I'm with you. Tell me what you ate, or use barcode or a nutrition label for packaged foods.";
  }
}

export function detectLoggerCommand(input: string, options?: { hasActiveMeal?: boolean; hasFavorite?: boolean }): LoggerCommand {
  const normalized = input.trim().toLowerCase();

  if (!normalized || !options?.hasActiveMeal) {
    return 'none';
  }

  if (saveCommandRegex.test(normalized)) {
    return 'save';
  }

  if (startOverCommandRegex.test(normalized)) {
    return 'start_over';
  }

  if (favoriteCommandRegex.test(normalized)) {
    return 'favorite';
  }

  if (options.hasFavorite && removeFavoriteCommandRegex.test(normalized)) {
    return 'remove_favorite';
  }

  return 'none';
}

export function buildLoggerQuestionReply(
  input: string,
  options?: {
    proteinGoal?: number | null;
    dailyCalorieGoal?: number | null;
    currentMealProtein?: number | null;
    currentMealCalories?: number | null;
  },
) {
  const normalized = input.trim().toLowerCase();

  if (/protein/.test(normalized) && /(should i eat|should i have|goal|target|aim)/.test(normalized) && options?.proteinGoal) {
    return `You're aiming for about ${Math.round(options.proteinGoal)}g of protein today. I can help you log meals toward that without making it a whole thing.`;
  }

  if (/calor/.test(normalized) && /(should i eat|goal|target|aim)/.test(normalized) && options?.dailyCalorieGoal) {
    return `You're aiming for about ${Math.round(options.dailyCalorieGoal)} calories today. I can keep the logging side simple while you track against it.`;
  }

  if (/protein/.test(normalized) && /(this|that|meal|shake|bowl|burger)/.test(normalized) && options?.currentMealProtein) {
    return `Right now I have this at about ${Math.round(options.currentMealProtein)}g of protein.`;
  }

  if (/calor/.test(normalized) && /(this|that|meal|shake|bowl|burger)/.test(normalized) && options?.currentMealCalories) {
    return `Right now I have this at about ${Math.round(options.currentMealCalories)} calories.`;
  }

  return "I can help with nutrition questions, but I'm best when we keep it tied to your meal or your daily goals.";
}
