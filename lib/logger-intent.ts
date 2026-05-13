import { analyzeMealText } from '@/lib/ai/analyze';

export type LoggerIntent = 'greeting' | 'food_log' | 'correction' | 'question' | 'unknown';

const greetingRegex = /^(hi|hello|hey|yo|sup|what'?s up|good morning|good afternoon|good evening|how are you|how'?s it going)(?:\b|[!.?,]|$)/i;
const questionRegex = /\?|^(what|how|can|could|would|should|do|does|is|are|am|will|did)\b/i;
const correctionRegex = /^(actually|sorry|correction|i meant|make that|change that|not exactly|update that|edit that)\b/i;
const foodSignalRegex = /\b(chipotle|starbucks|mcdonald'?s?|chick-?fil-?a|burger|fries|pizza|taco|burrito|sandwich|salad|bowl|rice|chicken|beef|steak|salmon|shrimp|pasta|noodles|egg|eggs|toast|bagel|oatmeal|yogurt|banana|apple|shake|smoothie|protein|latte|coffee|coke|soda|fairlife|quest|premier|bar|cookie|ice cream|frappuccino|mcdouble|mcchicken)\b/i;

export function detectLoggerIntent(input: string): LoggerIntent {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return 'unknown';
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
      return `Hey${namePrefix}, I'm ready when you are. Tell me what you ate and I'll estimate it.`;
    case 'correction':
      return options?.hasActiveMeal
        ? "Got it. Update the estimate below, or send the corrected meal in one message and I'll re-estimate it."
        : "No problem. Send the corrected meal in one message and I'll re-estimate it.";
    case 'question':
      return "I can help here, but this screen works best when you tell me what you ate. Send the meal naturally and I'll estimate it for you.";
    case 'unknown':
    default:
      return "I'm ready to log it whenever you are. Tell me what you ate, or use barcode or nutrition label for packaged foods.";
  }
}
