import {
  getOpenAIFoodIntelligenceTimeoutMs,
  getOpenAIMealModel,
  getServerOpenAIApiKey,
} from '@/lib/ai/runtimeConfig';

export { getOpenAIFoodIntelligenceTimeoutMs, getOpenAIMealModel, getServerOpenAIApiKey };

// Kept for compatibility with callers that import the old constant. Runtime code
// uses getOpenAIMealModel() so tests and server environments can change config safely.
export const openaiMealModel = getOpenAIMealModel().name;
