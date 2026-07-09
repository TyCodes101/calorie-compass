export const openaiMealModel = process.env.OPENAI_MEAL_MODEL?.trim() || 'gpt-4.1-mini';

type OpenAIEnv = Record<string, string | undefined>;

export function getServerOpenAIApiKey(env: OpenAIEnv = process.env) {
  const apiKey = env.OPENAI_API_KEY?.trim();
  return apiKey || null;
}

export function getOpenAIFoodIntelligenceTimeoutMs(env: OpenAIEnv = process.env) {
  const raw = Number(env.OPENAI_FOOD_INTELLIGENCE_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 4500;
}
