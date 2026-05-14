import { analyzeMealText } from '@/lib/ai/analyze';

export type LoggerIntent =
  | 'greeting'
  | 'food_log'
  | 'correction'
  | 'nutrition_question'
  | 'goal_question'
  | 'meal_history_question'
  | 'recommendation_request'
  | 'casual'
  | 'unknown';
export type LoggerCommand = 'save' | 'start_over' | 'favorite' | 'remove_favorite' | 'repeat_last_meal' | 'edit' | 'none';

const greetingRegex = /^(hi|hello|hey|yo|sup|what'?s up|good morning|good afternoon|good evening|how are you|how'?s it going)(?:\b|[!.?,]|$)/i;
const casualRegex = /^(ok|okay|kk|cool|nice|got it|sounds good|thanks|thank you|thx|lol|lmao|bet|hmm|huh|yep|yup)(?:\b|[!.?,]|$)/i;
const questionRegex = /\?|^(what|how|can|could|would|should|do|does|is|are|am|will|did)\b/i;
const goalQuestionRegex = /(how much (protein|calories?|calories) (do i have )?(left|remaining)|what('?s| is) left|how many calories do i have left|how much protein do i have left|am i on track|how far (off|away) am i|did i hit my goal)/i;
const nutritionQuestionRegex = /(protein|calories?|calories|carbs?|fat|fiber|sugar|sodium|macros?|nutrition)/i;
const mealHistoryRegex = /(what (did|have) i (eat|log)|what was (my )?(last|recent) meal|what did i have yesterday|what did i eat yesterday|what did i log yesterday|what did i eat today|what did i have today|last meal|recent meals?|yesterday'?s (dinner|lunch|breakfast|meals?))/i;
const recommendationRegex = /(what should i eat|what should i have|what do you recommend|any ideas? for|meal ideas?|recommend (something|a meal)|suggest (something|a meal)|give me (a|some) (meal )?ideas?|help me pick)/i;
const assistantQuestionRegex = /(help me log|can you help me|can you log|how does this work|what can you do)/i;
const correctionRegex = /^(actually|sorry|correction|i meant|make that|make it|change that|change it to|change to|not exactly|update that|edit that|add\b|remove|without|no\b|it was|that was|swap|hold the|skip the)\b/i;
const saveCommandRegex = /^(save( it| that| this)?|log( it| that| this)?|looks good|that'?s right|done|good to save|save now)\b/i;
const startOverCommandRegex = /^(start over|reset|new meal|clear this|try again|cancel|never mind|delete (it|this|that)|clear (it|this|that))\b/i;
const favoriteCommandRegex = /^(save favorite|favorite this|save as favorite)\b/i;
const removeFavoriteCommandRegex = /^(remove favorite|unfavorite this|delete favorite)\b/i;
const repeatLastMealCommandRegex = /^(repeat (my )?(last meal|last thing|last one)|same as (last time|usual)|load my last meal)\b/i;
const editCommandRegex = /^(edit( it| this| that)?|adjust( it| this| that)?|review (it|this|that)|show me the meal)\b/i;
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

  if (assistantQuestionRegex.test(normalized) && questionRegex.test(normalized)) {
    return 'nutrition_question';
  }

  if (casualRegex.test(normalized) && !hasFoodSignals) {
    return 'casual';
  }

  if (goalQuestionRegex.test(normalized)) {
    return 'goal_question';
  }

  if (questionRegex.test(normalized) && nutritionQuestionRegex.test(normalized)) {
    return 'nutrition_question';
  }

  if (questionRegex.test(normalized) && !analysis.brand && analysis.category === 'unknown' && !analysis.hasPortion && !analysis.hasExplicitCountableQuantity) {
    return 'nutrition_question';
  }

  if (correctionRegex.test(normalized) && !hasFoodSignals) {
    return 'correction';
  }

  if (hasFoodSignals) {
    return 'food_log';
  }

  if (questionRegex.test(normalized)) {
    return 'nutrition_question';
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
    case 'nutrition_question':
      return options?.hasActiveMeal
        ? "I can help with that. If it's about this meal, ask it naturally and I'll keep the current estimate in place."
        : "I can help with that. Ask the question naturally, or send the meal and I'll log it.";
    case 'goal_question':
      return options?.hasActiveMeal
        ? 'I can help with that. I’ll keep this meal in place and answer based on today so far.'
        : 'I can help with that. I’ll answer based on today so far and keep it practical.';
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

export function detectLoggerCommand(input: string, options?: { hasActiveMeal?: boolean; hasFavorite?: boolean; hasRecentMeal?: boolean }): LoggerCommand {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return 'none';
  }

  if (startOverCommandRegex.test(normalized)) {
    return 'start_over';
  }

  if (options?.hasRecentMeal && repeatLastMealCommandRegex.test(normalized)) {
    return 'repeat_last_meal';
  }

  if (!options?.hasActiveMeal) {
    return 'none';
  }

  if (saveCommandRegex.test(normalized)) {
    return 'save';
  }

  if (favoriteCommandRegex.test(normalized)) {
    return 'favorite';
  }

  if (options.hasFavorite && removeFavoriteCommandRegex.test(normalized)) {
    return 'remove_favorite';
  }

  if (editCommandRegex.test(normalized)) {
    return 'edit';
  }

  return 'none';
}

export function buildLoggerQuestionReply(
  input: string,
  options?: {
    proteinGoal?: number | null;
    dailyCalorieGoal?: number | null;
    todayProtein?: number | null;
    todayCalories?: number | null;
    remainingProtein?: number | null;
    remainingCalories?: number | null;
    currentMealProtein?: number | null;
    currentMealCalories?: number | null;
  },
) {
  const normalized = input.trim().toLowerCase();

  if (assistantQuestionRegex.test(normalized)) {
    return 'Just text me the meal like you would in a chat. You can also say things like “actually it was two,” “remove fries,” “save it,” or “how much protein do I have left?”';
  }

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

export function buildLoggerGoalReply(
  input: string,
  options?: {
    proteinGoal?: number | null;
    dailyCalorieGoal?: number | null;
    todayProtein?: number | null;
    todayCalories?: number | null;
    remainingProtein?: number | null;
    remainingCalories?: number | null;
    todayMealCount?: number | null;
    currentMealProtein?: number | null;
    currentMealCalories?: number | null;
  },
) {
  const normalized = input.trim().toLowerCase();

  if (/protein/.test(normalized) && options?.proteinGoal != null && options?.remainingProtein != null && options?.todayProtein != null) {
    if (options.currentMealProtein != null && options.currentMealProtein > 0) {
      const projectedProtein = options.todayProtein + options.currentMealProtein;
      const projectedRemaining = Math.max(0, Math.round(options.proteinGoal - projectedProtein));
      return `You’ve logged about ${Math.round(options.todayProtein)}g so far. If you save this meal, you’d be around ${Math.round(projectedProtein)}g, so about ${projectedRemaining}g short of your ${Math.round(options.proteinGoal)}g goal.`;
    }

    return `You’ve logged about ${Math.round(options.todayProtein)}g so far, so you have roughly ${Math.max(0, Math.round(options.remainingProtein))}g left to hit your ${Math.round(options.proteinGoal)}g goal.`;
  }

  if (/calor/.test(normalized) && options?.dailyCalorieGoal != null && options?.todayCalories != null && options?.remainingCalories != null) {
    if (options.currentMealCalories != null && options.currentMealCalories > 0) {
      const projectedCalories = options.todayCalories + options.currentMealCalories;
      const projectedRemaining = options.dailyCalorieGoal - projectedCalories;
      const projectedText = projectedRemaining >= 0 ? `${Math.round(projectedRemaining)} calories left` : `${Math.abs(Math.round(projectedRemaining))} calories over target`;
      return `You’ve logged about ${Math.round(options.todayCalories)} calories so far. If you save this meal, you’d be around ${Math.round(projectedCalories)} calories total, which puts you ${projectedText}.`;
    }

    const remainingText = options.remainingCalories >= 0 ? `${Math.round(options.remainingCalories)} calories left` : `${Math.abs(Math.round(options.remainingCalories))} calories over target`;
    return `You’ve logged about ${Math.round(options.todayCalories)} calories so far, so you’re ${remainingText} against your ${Math.round(options.dailyCalorieGoal)} calorie goal.`;
  }

  if (/on track|goal/.test(normalized) && options?.todayMealCount != null) {
    return `So far you’ve logged ${options.todayMealCount} meal${options.todayMealCount === 1 ? '' : 's'} today. If you want, I can use that plus your goals to suggest the next meal.`;
  }

  return 'I can help with what you have left today. Ask about calories, protein, or whether you’re on track.';
}
